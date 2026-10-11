import React, { useState } from 'react';
import { 
    X, Camera, Plane, Sliders, Settings, Edit3, Trash2, Copy, 
    Play, Eye, Radio, Shield, Wifi, Video, RefreshCw, 
    Maximize2, ChevronDown, ChevronUp, Download, Check, AlertCircle,
    Compass, MapPin, ZoomIn, ZoomOut, Volume2, ShieldCheck, Sparkles,
    Move
} from 'lucide-react';
import { toast } from 'sonner';
import type { PlantationCamera } from './SystemManagement/HardwareLabs/CameraNvrLab';
import type { DroneFlightMission, DroneFlightWaypoint } from './DroneFlightPathPlanner';
import { computeBlindZoneDistanceM } from '../utils/cameraGeospatial';

interface MapElementPropertiesPanelProps {
    selectedCamera: PlantationCamera | null;
    onUpdateCamera?: (cam: PlantationCamera) => void;
    onDeleteCamera?: (cameraId: string) => void;
    onCopyCamera?: (cam: PlantationCamera) => void;
    onOpenLiveView?: (cam: PlantationCamera) => void;

    selectedDroneMission: DroneFlightMission | null;
    onUpdateDroneMission?: (mission: DroneFlightMission) => void;
    onDeleteDroneMission?: () => void;
    onCopyDroneMission?: (mission: DroneFlightMission) => void;
    onStartDroneSimulation?: (mission: DroneFlightMission) => void;

    onClose: () => void;
    isKa?: boolean;
}

export const MapElementPropertiesPanel: React.FC<MapElementPropertiesPanelProps> = ({
    selectedCamera,
    onUpdateCamera,
    onDeleteCamera,
    onCopyCamera,
    onOpenLiveView,

    selectedDroneMission,
    onUpdateDroneMission,
    onDeleteDroneMission,
    onCopyDroneMission,
    onStartDroneSimulation,

    onClose,
    isKa = false
}) => {
    const isCamera = !!selectedCamera;
    const isDrone = !!selectedDroneMission;

    const [activeTab, setActiveTab] = useState<'manage' | 'config' | 'edit'>('manage');
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

    if (!isCamera && !isDrone) return null;

    // Camera Handlers
    const handleCameraFieldChange = (fields: Partial<PlantationCamera>) => {
        if (!selectedCamera || !onUpdateCamera) return;
        const updated = { ...selectedCamera, ...fields };
        onUpdateCamera(updated);
    };

    const handleCameraCopy = () => {
        if (!selectedCamera) return;
        if (onCopyCamera) {
            onCopyCamera(selectedCamera);
        } else {
            toast.success(isKa ? 'კამერის ასლი შეიქმნა' : 'Camera duplicated');
        }
    };

    const handleCameraDelete = () => {
        if (!selectedCamera || !onDeleteCamera) return;
        onDeleteCamera(selectedCamera.id);
        toast.info(isKa ? `კამერა "${selectedCamera.name}" წაიშალა` : `Camera "${selectedCamera.name}" deleted`);
        onClose();
    };

    // Drone Handlers
    const handleDroneFieldChange = (fields: Partial<DroneFlightMission>) => {
        if (!selectedDroneMission || !onUpdateDroneMission) return;
        const updated = { ...selectedDroneMission, ...fields };
        onUpdateDroneMission(updated);
    };

    const handleDroneCopy = () => {
        if (!selectedDroneMission) return;
        if (onCopyDroneMission) {
            onCopyDroneMission(selectedDroneMission);
        } else {
            toast.success(isKa ? 'მარშრუტის ასლი შეიქმნა' : 'Flight path duplicated');
        }
    };

    const handleDroneDelete = () => {
        if (!selectedDroneMission || !onDeleteDroneMission) return;
        onDeleteDroneMission();
        toast.info(isKa ? 'დრონის მარშრუტი წაიშალა' : 'Drone flight path deleted');
        onClose();
    };

    // Camera Blind Zone & Ground Coverage
    const blindZoneDist = selectedCamera 
        ? computeBlindZoneDistanceM(selectedCamera.mountHeightM || 6, selectedCamera.tiltAngleDeg || 4, selectedCamera.fovAngleDeg || 95)
        : 0;

    // Drone Total Distance Calculation
    const totalDroneDistanceMeters = (() => {
        if (!selectedDroneMission) return 0;
        if (selectedDroneMission.mode === 'circle_sector') {
            const r = selectedDroneMission.circleRadiusM || 60;
            return Math.round(2 * Math.PI * r);
        }
        if (selectedDroneMission.waypoints.length < 2) return 0;
        let d = 0;
        for (let i = 0; i < selectedDroneMission.waypoints.length - 1; i++) {
            const p1 = selectedDroneMission.waypoints[i];
            const p2 = selectedDroneMission.waypoints[i + 1];
            const dLat = (p2.lat - p1.lat) * 111111;
            const dLng = (p2.lng - p1.lng) * 111111 * Math.cos((p1.lat * Math.PI) / 180);
            d += Math.sqrt(dLat * dLat + dLng * dLng);
        }
        return Math.round(d);
    })();

    const flightDurationSec = selectedDroneMission 
        ? Math.round(totalDroneDistanceMeters / Math.max(1, selectedDroneMission.speedMs || 10))
        : 0;

    return (
        <div className="fixed top-20 left-4 sm:left-6 z-[2400] w-[340px] sm:w-[410px] bg-slate-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200 text-white select-none">
            
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-xl border flex items-center justify-center ${
                        isCamera 
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' 
                            : 'bg-cyan-600/20 border-cyan-500/40 text-cyan-400'
                    }`}>
                        {isCamera ? <Camera size={18} /> : <Plane size={18} />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                {isCamera 
                                    ? (isKa ? 'სათვალთვალო კამერა' : 'Surveillance Camera') 
                                    : (isKa ? 'დრონის მარშრუტი' : 'Drone Flight Path')}
                            </span>
                            {isCamera && (
                                <span className="px-1.5 py-0.2 rounded-md font-mono text-[9px] bg-blue-950 text-blue-300 border border-blue-800/60 font-bold">
                                    CH0{selectedCamera.channel}
                                </span>
                            )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-black text-white truncate max-w-[190px] sm:max-w-[240px]">
                            {isCamera ? selectedCamera.name : selectedDroneMission?.name}
                        </h4>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-rose-900/40 hover:text-rose-400 rounded-xl text-slate-400 transition-colors cursor-pointer"
                        title="Close Properties Panel"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Quick Action Bar: Copy & Delete with Listed Options */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/50 border-b border-slate-800/80 text-xs">
                <div className="flex items-center gap-1.5">
                    {/* Copy Button */}
                    <button
                        type="button"
                        onClick={isCamera ? handleCameraCopy : handleDroneCopy}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700 active:scale-95 shadow-sm"
                        title={isKa ? 'ობიექტის სრული ასლის შექმნა (Copy / Duplicate)' : 'Duplicate item with full properties'}
                    >
                        <Copy size={12} className="text-amber-400" />
                        <span>{isKa ? 'ასლის შექმნა (COPY)' : 'COPY'}</span>
                    </button>

                    {/* Delete Button with Confirmation */}
                    {confirmDelete ? (
                        <div className="flex items-center gap-1 bg-red-950/80 border border-red-700 px-2 py-0.5 rounded-xl">
                            <span className="text-[10px] text-red-300 font-bold">{isKa ? 'დარწმუნებული ხართ?' : 'Delete?'}</span>
                            <button
                                type="button"
                                onClick={isCamera ? handleCameraDelete : handleDroneDelete}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[9px] font-black uppercase cursor-pointer"
                            >
                                {isKa ? 'დიახ' : 'Yes'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                className="px-2 py-1 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] cursor-pointer"
                            >
                                {isKa ? 'არა' : 'No'}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-red-800/40 active:scale-95"
                            title={isKa ? 'ობიექტის წაშლა რუკიდან' : 'Delete item from map'}
                        >
                            <Trash2 size={12} />
                            <span>{isKa ? 'წაშლა (DELETE)' : 'DELETE'}</span>
                        </button>
                    )}
                </div>

                {/* Primary Action Button (Live View for Cam / Start Sim for Drone) */}
                {isCamera && onOpenLiveView && (
                    <button
                        type="button"
                        onClick={() => onOpenLiveView(selectedCamera)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-900/40 active:scale-95"
                    >
                        <Video size={12} />
                        <span>{isKa ? 'LIVE ეთერი' : 'LIVE VIEW'}</span>
                    </button>
                )}

                {isDrone && onStartDroneSimulation && (
                    <button
                        type="button"
                        onClick={() => onStartDroneSimulation(selectedDroneMission)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-900/40 active:scale-95"
                    >
                        <Play size={12} />
                        <span>{isKa ? 'სიმულაცია' : 'SIMULATION'}</span>
                    </button>
                )}
            </div>

            {/* Collapsible Body */}
            {!isMinimized && (
                <div>
                    {/* Navigation Tabs: MANAGE | CONFIG | EDIT */}
                    <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 text-xs font-black uppercase tracking-wider">
                        <button
                            type="button"
                            onClick={() => setActiveTab('manage')}
                            className={`flex-1 py-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'manage'
                                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Sliders size={13} />
                            <span>{isKa ? 'მართვა' : 'MANAGE'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('config')}
                            className={`flex-1 py-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'config'
                                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Settings size={13} />
                            <span>{isKa ? 'კონფიგი' : 'CONFIG'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('edit')}
                            className={`flex-1 py-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'edit'
                                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Edit3 size={13} />
                            <span>{isKa ? 'შესწორება' : 'EDIT'}</span>
                        </button>
                    </div>

                    {/* Content Section */}
                    <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar text-xs text-slate-300">
                        
                        {/* ===================== TAB 1: MANAGE ===================== */}
                        {activeTab === 'manage' && (
                            <div className="space-y-3">
                                {isCamera && (
                                    <>
                                        {/* Status & Latency Card */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-bold block">{isKa ? 'სტატუსი' : 'Status'}</span>
                                                <span className="text-emerald-400 font-black flex items-center gap-1 mt-0.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    {selectedCamera.status || 'ONLINE'}
                                                </span>
                                            </div>
                                            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-bold block">{isKa ? 'დაყოვნება (Ping)' : 'Latency'}</span>
                                                <span className="text-white font-mono font-bold mt-0.5 block">14 ms (LAN)</span>
                                            </div>
                                        </div>

                                        {/* Coordinates & Elevation */}
                                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                                <span>{isKa ? 'კოორდინატები' : 'Location Coordinates'}</span>
                                                <span className="text-blue-400 font-mono">CH0{selectedCamera.channel}</span>
                                            </div>
                                            <div className="font-mono text-white text-xs">
                                                {selectedCamera.lat.toFixed(6)}, {selectedCamera.lng.toFixed(6)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                                                <span>{isKa ? 'სამონტაჟო ბოძი:' : 'Pole Height:'} {selectedCamera.mountHeightM}m</span>
                                                <span>{isKa ? 'დახრა:' : 'Tilt:'} {selectedCamera.tiltAngleDeg || 4}°</span>
                                                <span className="text-red-400 font-mono">{isKa ? 'ბრმა ზონა:' : 'Blind:'} &lt;{blindZoneDist}m</span>
                                            </div>
                                        </div>

                                        {/* Optical Coverage Radii */}
                                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                                <span>{isKa ? 'ოპტიკური დისტანცია & კუთხე' : 'Optical Range & FOV'}</span>
                                                <span className="text-emerald-400 font-mono font-bold">{selectedCamera.rangeM}m</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                                                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                                                    <span className="text-slate-400 block text-[8px]">FOV</span>
                                                    <span className="text-white font-bold">{selectedCamera.fovAngleDeg}°</span>
                                                </div>
                                                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                                                    <span className="text-slate-400 block text-[8px]">AZIMUTH</span>
                                                    <span className="text-cyan-400 font-bold">{selectedCamera.azimuthDeg}°</span>
                                                </div>
                                                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                                                    <span className="text-slate-400 block text-[8px]">IR NIGHT</span>
                                                    <span className="text-amber-400 font-bold">{selectedCamera.isNightVision ? 'ON' : 'OFF'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {isDrone && (
                                    <>
                                        {/* Drone Mission Stats */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-bold block">{isKa ? 'მთლიანი მანძილი' : 'Total Distance'}</span>
                                                <span className="text-cyan-400 font-black font-mono mt-0.5 block">
                                                    {totalDroneDistanceMeters >= 1000 
                                                        ? `${(totalDroneDistanceMeters / 1000).toFixed(2)} km` 
                                                        : `${totalDroneDistanceMeters} m`}
                                                </span>
                                            </div>
                                            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-bold block">{isKa ? 'ფრენის დრო' : 'Flight Time'}</span>
                                                <span className="text-emerald-400 font-mono font-bold mt-0.5 block">
                                                    ~{Math.floor(flightDurationSec / 60)}m {flightDurationSec % 60}s
                                                </span>
                                            </div>
                                        </div>

                                        {/* Waypoints Breakdown */}
                                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                <span>{isKa ? 'მარშრუტის წერტილები' : 'Mission Waypoints'}</span>
                                                <span className="text-cyan-400 font-mono">{selectedDroneMission.waypoints.length} Points</span>
                                            </div>
                                            <div className="max-h-28 overflow-y-auto space-y-1 custom-scrollbar">
                                                {selectedDroneMission.waypoints.map((wp, idx) => (
                                                    <div key={wp.id || idx} className="flex items-center justify-between p-1.5 bg-slate-950 rounded-lg text-[10px] font-mono border border-slate-800/80">
                                                        <span className="text-cyan-300 font-bold">
                                                            {idx === 0 ? 'Home (Takeoff)' : wp.leg === 'return' ? 'RTH (Return)' : `WP #${idx}`}
                                                        </span>
                                                        <span className="text-slate-400">
                                                            Alt: {wp.altitudeM || selectedDroneMission.altitudeM}m • Spd: {wp.speedMs || selectedDroneMission.speedMs}m/s
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ===================== TAB 2: CONFIG ===================== */}
                        {activeTab === 'config' && (
                            <div className="space-y-3">
                                {isCamera && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'IP მისამართი' : 'IP Address'}
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedCamera.ipAddress}
                                                onChange={(e) => handleCameraFieldChange({ ipAddress: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                    {isKa ? 'RTSP პორტი' : 'RTSP Port'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={selectedCamera.rtspPort}
                                                    onChange={(e) => handleCameraFieldChange({ rtspPort: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                    {isKa ? 'NVR არხი' : 'NVR Channel'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="32"
                                                    value={selectedCamera.channel}
                                                    onChange={(e) => handleCameraFieldChange({ channel: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'RTSP სტრიმის URL' : 'RTSP Stream URL'}
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedCamera.streamUrl || `rtsp://CAMERA_HOST/${selectedCamera.ipAddress}:554/Streaming/Channels/${selectedCamera.channel}01`}
                                                onChange={(e) => handleCameraFieldChange({ streamUrl: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-[11px] outline-none focus:border-blue-500 truncate"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                                            <span className="text-[11px] font-bold text-slate-300">
                                                {isKa ? 'ღამის ხედვა (IR Night Vision)' : 'IR Night Vision'}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={selectedCamera.isNightVision}
                                                onChange={(e) => handleCameraFieldChange({ isNightVision: e.target.checked })}
                                                className="w-4 h-4 rounded text-blue-500 accent-blue-500 cursor-pointer"
                                            />
                                        </div>
                                    </>
                                )}

                                {isDrone && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                    {isKa ? 'ფრენის სიმაღლე (მ)' : 'Flight Altitude (m)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="10"
                                                    max="150"
                                                    value={selectedDroneMission.altitudeM}
                                                    onChange={(e) => handleDroneFieldChange({ altitudeM: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                    {isKa ? 'სიჩქარე (მ/წმ)' : 'Speed (m/s)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="2"
                                                    max="25"
                                                    value={selectedDroneMission.speedMs}
                                                    onChange={(e) => handleDroneFieldChange({ speedMs: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'ფოტოს ინტერვალი (წამი)' : 'Trigger Interval (sec)'}
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={selectedDroneMission.timeIntervalSec || 5}
                                                onChange={(e) => handleDroneFieldChange({ timeIntervalSec: Number(e.target.value) })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ===================== TAB 3: EDIT ===================== */}
                        {activeTab === 'edit' && (
                            <div className="space-y-3">
                                {isCamera && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'კამერის სახელი' : 'Camera Label'}
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedCamera.name}
                                                onChange={(e) => handleCameraFieldChange({ name: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'ლოკაციის სახელი' : 'Location Name'}
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedCamera.locationName || ''}
                                                onChange={(e) => handleCameraFieldChange({ locationName: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        {/* Sliders with direct inputs for Tilt, Range, Azimuth */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {isKa ? 'დახრის კუთხე (Tilt - ნაგულისხმევი 4°)' : 'Downward Tilt Angle (Default 4°)'}
                                                </span>
                                                <span className="text-amber-400 font-mono font-bold">{selectedCamera.tiltAngleDeg || 4}°</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="35"
                                                value={selectedCamera.tiltAngleDeg || 4}
                                                onChange={(e) => handleCameraFieldChange({ tiltAngleDeg: Number(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {isKa ? 'აზიმუტი (მიმართულება 0°–360°)' : 'Azimuth Direction (0°–360°)'}
                                                </span>
                                                <span className="text-blue-400 font-mono font-bold">{selectedCamera.azimuthDeg || 0}°</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="359"
                                                value={selectedCamera.azimuthDeg || 0}
                                                onChange={(e) => handleCameraFieldChange({ azimuthDeg: Number(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {isKa ? 'სათვალთვალო დისტანცია (მ)' : 'Optical Range (m)'}
                                                </span>
                                                <span className="text-emerald-400 font-mono font-bold">{selectedCamera.rangeM}m</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="15"
                                                max="250"
                                                value={selectedCamera.rangeM}
                                                onChange={(e) => handleCameraFieldChange({ rangeM: Number(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>
                                    </>
                                )}

                                {isDrone && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'მისიის სახელი' : 'Mission Name'}
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedDroneMission.name}
                                                onChange={(e) => handleDroneFieldChange({ name: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'ფრენის რეჟიმი' : 'Flight Mode'}
                                            </label>
                                            <select
                                                value={selectedDroneMission.mode}
                                                onChange={(e) => handleDroneFieldChange({ mode: e.target.value as any })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-500"
                                            >
                                                <option value="waypoints">{isKa ? 'წერტილები (Waypoints)' : 'Waypoints'}</option>
                                                <option value="circle_sector">{isKa ? 'სექტორის ორბიტა (Circle Sector)' : 'Circle Sector Orbit'}</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
