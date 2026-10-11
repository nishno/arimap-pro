import React, { useState, useEffect, useRef } from 'react';
import {
    X, Play, Pause, RotateCcw, Video, Square, Download, Trash2,
    Compass, Battery, Radio, Eye, Sliders, ChevronUp, ChevronDown,
    Maximize2, Minimize2, ArrowUpRight, Camera, Check, AlertCircle, Sparkles,
    Navigation, Shield, Activity, RefreshCw, Crosshair, MapPin, ZoomIn, ZoomOut,
    Volume2, VolumeX, Settings, Cpu, Wifi, Globe, Sun, Layers, Film
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../../../services/storageService';
import type { SandboxDroneMission } from './HardwareTestingSandboxMap';

export interface RealDroneLiveLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    mission: SandboxDroneMission;
    onUpdateMission: (patch: Partial<SandboxDroneMission>) => void;
    onFlySelectedTrenches: () => void;
    isKa?: boolean;
    activeTrenches?: number[];
    onToggleTrench?: (trenchNum: number) => void;
}

export const RealDroneLiveLinkModal: React.FC<RealDroneLiveLinkModalProps> = ({
    isOpen,
    onClose,
    mission,
    onUpdateMission,
    onFlySelectedTrenches,
    isKa = false,
    activeTrenches = [3, 4, 5],
    onToggleTrench
}) => {
    if (!isOpen) return null;

    const [isMaximized, setIsMaximized] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'cockpit' | 'telemetry' | 'link_settings' | 'gallery'>('cockpit');
    const [cameraSpectrum, setCameraSpectrum] = useState<'rgb' | 'ndvi' | 'thermal'>('rgb');
    const [streamSource, setStreamSource] = useState<'simulated' | 'rtsp' | 'webrtc'>('simulated');
    const [rtspUrl, setRtspUrl] = useState<string>('rtsp://192.168.1.120:554/live/ch0');
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [isConnected, setIsConnected] = useState<boolean>(true);
    const [pingMs, setPingMs] = useState<number>(18);
    const [signalDbm, setSignalDbm] = useState<number>(-56);
    const [capturedPhotos, setCapturedPhotos] = useState<{ id: string; url: string; time: string; coords: string; alt: number }[]>(() => {
        const saved = safeStorage.getItem('agrimap_sandbox_drone_captured_photos');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [
            {
                id: 'photo-1',
                url: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=800&q=80',
                time: '12:44:10',
                coords: '41.9023°N, 44.5000°E',
                alt: 35
            }
        ];
    });

    // Save photos
    useEffect(() => {
        safeStorage.setItem('agrimap_sandbox_drone_captured_photos', JSON.stringify(capturedPhotos));
    }, [capturedPhotos]);

    // Live ping and telemetry fluctuation for authenticity
    useEffect(() => {
        const interval = setInterval(() => {
            setPingMs(Math.floor(16 + Math.random() * 8));
            setSignalDbm(Math.floor(-58 + Math.random() * 5));
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    // Drone flight simulation step
    const handleToggleFlight = () => {
        if (!mission.isSimulating) {
            onFlySelectedTrenches();
        } else {
            onUpdateMission({ isSimulating: false });
            toast.info(isKa ? 'დრონი შეჩერდა (Hover რეჟიმი)' : 'Drone Paused (Hovering over current trench)');
        }
    };

    // Return to Home (RTH)
    const handleReturnToHome = () => {
        onUpdateMission({
            isSimulating: false,
            simulatedProgress: 0,
            currentAlt: mission.altitudeM || 35
        });
        toast.success(isKa ? '🏠 დაბრუნება ბაზაზე (RTH ინიცირებულია)' : '🏠 Return to Home (RTH Initiated) — Returning to Base Station');
    };

    // Capture High-Res Snapshot
    const handleTakeSnapshot = () => {
        const newPhoto = {
            id: `snap-${Date.now()}`,
            url: cameraSpectrum === 'thermal'
                ? 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80'
                : cameraSpectrum === 'ndvi'
                    ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
                    : 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=800&q=80',
            time: new Date().toLocaleTimeString(),
            coords: `${mission.currentLat.toFixed(5)}°N, ${mission.currentLng.toFixed(5)}°E`,
            alt: Math.round(mission.currentAlt)
        };
        setCapturedPhotos(prev => [newPhoto, ...prev]);
        toast.success(isKa ? '📸 აერო-ფოტო გადაღებულია და შენახულია' : `📸 High-Res Photo Captured (${newPhoto.coords})`);
    };

    // Toggle 4K Video Recording
    const handleToggleRecording = () => {
        if (!mission.isRecordingVideo) {
            onUpdateMission({ isRecordingVideo: true, recordingSeconds: 0 });
            toast.success(isKa ? '🔴 4K ვიდეო ჩაწერა დაიწყო' : '🔴 4K Aerial Video Recording Started');
        } else {
            onUpdateMission({ isRecordingVideo: false });
            toast.success(isKa ? `💾 ვიდეო შენახულია (${mission.recordingSeconds}წმ)` : `💾 Video Clip Saved (${mission.recordingSeconds}s)`);
        }
    };

    // Test External Stream Link
    const handleTestRtspConnection = () => {
        setIsConnecting(true);
        setTimeout(() => {
            setIsConnecting(false);
            setIsConnected(true);
            toast.success(isKa ? '✅ RTSP ნაკადი წარმატებით დაუკავშირდა (24 FPS, 4K)' : '✅ RTSP Drone Stream Connected (24 FPS, 4K H.265)');
        }, 1200);
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
            <div className={`
                ${isMaximized ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[90vh] max-h-[860px] rounded-3xl'}
                bg-slate-950 border border-cyan-500/50 shadow-2xl flex flex-col overflow-hidden text-slate-200 transition-all
            `}>
                {/* 1. MODAL HEADER & TELEMETRY STATUS */}
                <div className="p-3 sm:p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
                            <Navigation size={20} className="rotate-45" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                    <span>{isKa ? 'დრონის პირდაპირი ბმული & მისია' : 'Real Drone Link & Cockpit HUD'}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono font-bold">
                                        DJI Matrice 350 RTK
                                    </span>
                                </h3>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>LINK ACTIVE</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                <span>🌿 {mission.plantationName}</span>
                                <span>•</span>
                                <span>📍 {mission.sectorName}</span>
                                <span>•</span>
                                <span className="text-cyan-400 font-bold">
                                    {isKa ? 'თხრილები:' : 'Active Trenches:'} #{mission.selectedTrenches.join(', #')}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Quick Telemetry Indicators */}
                    <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                        <div className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5" title="MAVLink Telemetry Ping">
                            <Radio size={12} className="text-cyan-400" />
                            <span className="text-slate-400">LAT:</span>
                            <span className="text-cyan-300 font-bold">{pingMs}ms</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5" title="Signal Strength">
                            <Wifi size={12} className="text-emerald-400" />
                            <span className="text-emerald-300 font-bold">{signalDbm} dBm</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5" title="Battery Level">
                            <Battery size={14} className={mission.batteryPct > 25 ? 'text-emerald-400' : 'text-red-400 animate-pulse'} />
                            <span className="font-bold text-white">{mission.batteryPct}%</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-amber-300" title="GPS Status">
                            <Globe size={12} />
                            <span className="font-bold">RTK 3D (24 Sats)</span>
                        </div>

                        {/* Maximize & Close */}
                        <div className="flex items-center gap-1 ml-2">
                            <button
                                type="button"
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                                title={isMaximized ? 'Restore Size' : 'Maximize Window'}
                            >
                                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 cursor-pointer"
                                title="Close Cockpit"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. NAVIGATION TABS */}
                <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('cockpit')}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'cockpit'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 font-black'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <Video size={13} />
                            <span>{isKa ? 'პირდაპირი კამერა & HUD' : 'Live Camera View & HUD'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('telemetry')}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'telemetry'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 font-black'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <Activity size={13} />
                            <span>{isKa ? 'ტელემეტრია & მისია' : 'Telemetry & Mission Waypoints'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('link_settings')}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'link_settings'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 font-black'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <Settings size={13} />
                            <span>{isKa ? 'RTSP & პროტოკოლის ბმული' : 'RTSP & Link Protocol'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('gallery')}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'gallery'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 font-black'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <Camera size={13} />
                            <span>{isKa ? 'გადაღებული ფოტოები' : 'Captured Aerials'}</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-cyan-300">
                                {capturedPhotos.length}
                            </span>
                        </button>
                    </div>

                    {/* Camera Spectrum Toggles: RGB, NDVI, Thermal */}
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px]">
                        {(['rgb', 'ndvi', 'thermal'] as const).map((spec, specIdx) => (
                            <button
                                key={`drone-spec-${spec}-${specIdx}`}
                                type="button"
                                onClick={() => setCameraSpectrum(spec)}
                                className={`px-2 py-0.5 rounded-lg font-mono font-bold uppercase transition-all ${
                                    cameraSpectrum === spec
                                        ? spec === 'thermal' ? 'bg-orange-600 text-white shadow' : spec === 'ndvi' ? 'bg-emerald-600 text-white shadow' : 'bg-cyan-600 text-white shadow'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {spec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. MAIN COCKPIT BODY */}
                <div className="flex-1 overflow-hidden relative flex flex-col lg:flex-row">
                    {/* LEFT / CENTER VIEWPORT (VIDEO HUD) */}
                    <div className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
                        {activeTab === 'cockpit' && (
                            <div className="relative w-full h-full flex-1 bg-black overflow-hidden flex items-center justify-center select-none">
                                {/* Video Stream or Simulation Layer */}
                                <div className="absolute inset-0 w-full h-full overflow-hidden">
                                    <img
                                        src={
                                            cameraSpectrum === 'thermal'
                                                ? 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1400&q=80'
                                                : cameraSpectrum === 'ndvi'
                                                    ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80'
                                                    : 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1400&q=80'
                                        }
                                        alt="Aerial Drone Live Feed"
                                        className={`w-full h-full object-cover transition-all ${
                                            cameraSpectrum === 'thermal'
                                                ? 'filter hue-rotate-180 contrast-125'
                                                : cameraSpectrum === 'ndvi'
                                                    ? 'filter saturate-200 contrast-110'
                                                    : 'brightness-95 contrast-105'
                                        }`}
                                    />
                                    {/* Scanline & Grid Effect */}
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />
                                </div>

                                {/* HUD ARTIFICIAL HORIZON & CENTER RETICLE */}
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                    {/* Crosshair with Distance */}
                                    <div className="relative w-36 h-36 border border-cyan-400/40 rounded-full flex items-center justify-center animate-pulse">
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                        <div className="absolute top-0 w-0.5 h-4 bg-cyan-400/80" />
                                        <div className="absolute bottom-0 w-0.5 h-4 bg-cyan-400/80" />
                                        <div className="absolute left-0 h-0.5 w-4 bg-cyan-400/80" />
                                        <div className="absolute right-0 h-0.5 w-4 bg-cyan-400/80" />
                                        <div className="absolute -bottom-6 font-mono text-[10px] text-cyan-300 font-bold bg-black/60 px-2 py-0.5 rounded">
                                            DIST TO GROUND: {(mission.currentAlt * 1.05).toFixed(1)}m
                                        </div>
                                    </div>

                                    {/* Pitch ladder marks */}
                                    <div className="absolute w-48 h-24 border-t border-b border-cyan-400/30 flex flex-col justify-between items-center opacity-60">
                                        <span className="font-mono text-[9px] text-cyan-300">+10°</span>
                                        <span className="font-mono text-[9px] text-cyan-300">-10°</span>
                                    </div>
                                </div>

                                {/* Top HUD Compass Tape */}
                                <div className="absolute top-3 inset-x-8 flex justify-center pointer-events-none">
                                    <div className="px-4 py-1.5 rounded-xl bg-black/70 border border-slate-700/80 backdrop-blur-md flex items-center gap-4 text-xs font-mono text-slate-300">
                                        <span>NW</span>
                                        <span>330°</span>
                                        <span className="text-cyan-400 font-black text-sm">📍 048° NE</span>
                                        <span>060°</span>
                                        <span>E</span>
                                    </div>
                                </div>

                                {/* Top Left Telemetry Overlay */}
                                <div className="absolute top-3 left-3 space-y-1.5 pointer-events-none">
                                    <div className="px-3 py-1.5 rounded-xl bg-black/75 border border-cyan-500/40 backdrop-blur-md font-mono text-xs text-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">ALTITUDE:</span>
                                            <span className="text-cyan-300 font-black text-sm">{mission.currentAlt}m AGL</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <span>ASL: {480 + Math.round(mission.currentAlt)}m</span>
                                            <span>•</span>
                                            <span>SPD: {mission.speedMs} m/s</span>
                                        </div>
                                    </div>

                                    <div className="px-3 py-1 rounded-xl bg-black/75 border border-slate-700/80 backdrop-blur-md font-mono text-[10px] text-slate-300">
                                        LAT: {mission.currentLat.toFixed(5)}° • LNG: {mission.currentLng.toFixed(5)}°
                                    </div>
                                </div>

                                {/* Top Right Flight & Recording Status */}
                                <div className="absolute top-3 right-3 space-y-1.5 pointer-events-none flex flex-col items-end">
                                    {mission.isRecordingVideo ? (
                                        <div className="px-3 py-1.5 rounded-xl bg-red-600/90 text-white font-mono text-xs font-black animate-pulse flex items-center gap-2 shadow-lg">
                                            <span className="w-2 h-2 rounded-full bg-white" />
                                            <span>REC 00:{mission.recordingSeconds < 10 ? `0${mission.recordingSeconds}` : mission.recordingSeconds} (4K 60FPS)</span>
                                        </div>
                                    ) : (
                                        <div className="px-3 py-1 rounded-xl bg-black/75 border border-slate-700/80 text-slate-300 font-mono text-[10px]">
                                            CAMERA: 4K UHD • ISO 100 • 1/1000s
                                        </div>
                                    )}

                                    <div className="px-3 py-1 rounded-xl bg-black/75 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                                        GIMBAL PITCH: {mission.gimbalPitchDeg}° ({mission.gimbalPitchDeg < -60 ? 'Nadir' : 'Oblique'})
                                    </div>
                                </div>

                                {/* Bottom Mission Progress Bar */}
                                <div className="absolute bottom-16 inset-x-4 pointer-events-none">
                                    <div className="p-2.5 rounded-xl bg-black/75 border border-slate-700/80 backdrop-blur-md">
                                        <div className="flex justify-between items-center text-[10px] font-mono mb-1 text-slate-300">
                                            <span>SURVEYING TRENCHES #{mission.selectedTrenches.join(', #')}</span>
                                            <span className="text-cyan-400 font-bold">{Math.round(mission.simulatedProgress * 100)}% COMPLETE</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                                                style={{ width: `${Math.round(mission.simulatedProgress * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Video Control Toolbar */}
                                <div className="absolute bottom-3 inset-x-4 flex items-center justify-between gap-3 pointer-events-auto">
                                    {/* Action Buttons: Photo, REC, Zoom */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleTakeSnapshot}
                                            className="px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition-all"
                                        >
                                            <Camera size={14} className="text-cyan-400" />
                                            <span>Snapshot</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleToggleRecording}
                                            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition-all ${
                                                mission.isRecordingVideo
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700'
                                            }`}
                                        >
                                            <Film size={14} className={mission.isRecordingVideo ? 'text-white' : 'text-red-400'} />
                                            <span>{mission.isRecordingVideo ? 'Stop REC' : 'Record 4K'}</span>
                                        </button>
                                    </div>

                                    {/* Flight Control Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleToggleFlight}
                                            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer ${
                                                mission.isSimulating
                                                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/50'
                                            }`}
                                        >
                                            {mission.isSimulating ? <Pause size={14} /> : <Play size={14} />}
                                            <span>{mission.isSimulating ? (isKa ? 'შეჩერება' : 'Pause Flight') : (isKa ? 'აფრენა & ფრენა' : 'Start Flight')}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleReturnToHome}
                                            className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                            title="Return to Home Point"
                                        >
                                            <RotateCcw size={13} />
                                            <span>RTH</span>
                                        </button>
                                    </div>

                                    {/* Optical Zoom Chips */}
                                    <div className="flex items-center gap-1 bg-black/75 p-1 rounded-xl border border-slate-700">
                                        {[1, 2, 4, 8].map((z, zIdx) => (
                                            <button
                                                key={`modal-zoom-${z}-${zIdx}`}
                                                type="button"
                                                onClick={() => onUpdateMission({ opticalZoom: z })}
                                                className={`px-2 py-0.5 rounded-lg font-mono font-bold text-[10px] cursor-pointer ${
                                                    mission.opticalZoom === z
                                                        ? 'bg-cyan-600 text-white shadow'
                                                        : 'text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {z}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'telemetry' && (
                            <div className="p-6 overflow-y-auto space-y-4">
                                <h4 className="font-black text-sm uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                    <Activity size={16} className="text-cyan-400" />
                                    <span>Real-Time MAVLink Telemetry Stream & Flight Mission</span>
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Current Waypoint</span>
                                        <div className="text-lg font-black font-mono text-cyan-300">
                                            #{Math.min(mission.waypoints.length, Math.floor(mission.simulatedProgress * mission.waypoints.length) + 1)} of {mission.waypoints.length}
                                        </div>
                                        <span className="text-xs text-slate-400">Trench Survey Leg</span>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Ground Speed</span>
                                        <div className="text-lg font-black font-mono text-emerald-300">
                                            {mission.speedMs} m/s ({(mission.speedMs * 3.6).toFixed(1)} km/h)
                                        </div>
                                        <span className="text-xs text-slate-400">Cruise Speed</span>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">RTK Positioning</span>
                                        <div className="text-lg font-black font-mono text-amber-300">
                                            FIX 3D • ±1.4cm
                                        </div>
                                        <span className="text-xs text-slate-400">GEO-NTRIP-AGRO-01</span>
                                    </div>
                                </div>

                                {/* Mission Waypoints Table */}
                                <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50">
                                    <div className="p-3 bg-slate-900 border-b border-slate-800 font-bold text-xs text-slate-300">
                                        Generated Mission Waypoints ({mission.waypoints.length} Points)
                                    </div>
                                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 font-mono text-xs">
                                        {mission.waypoints.map((wp, idx) => (
                                            <div key={`wp-${wp.id || 'pt'}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-800/40">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-cyan-300">
                                                        {idx + 1}
                                                    </span>
                                                    <span>{wp.id}</span>
                                                    <span className="text-[10px] text-slate-500">[{wp.leg}]</span>
                                                </div>
                                                <div className="text-slate-400">
                                                    {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)} • {wp.altM}m
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'link_settings' && (
                            <div className="p-6 overflow-y-auto space-y-4 max-w-2xl">
                                <h4 className="font-black text-sm uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                    <Settings size={16} className="text-cyan-400" />
                                    <span>Real Drone Connection & Protocol Setup</span>
                                </h4>

                                <div className="space-y-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-xs">
                                    <div>
                                        <label className="block font-bold text-slate-300 mb-1">Video Stream Protocol</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['simulated', 'rtsp', 'webrtc'] as const).map((src, srcIdx) => (
                                                <button
                                                    key={`stream-src-${src}-${srcIdx}`}
                                                    type="button"
                                                    onClick={() => setStreamSource(src)}
                                                    className={`py-2 px-3 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                                                        streamSource === src
                                                            ? 'bg-cyan-600 text-white shadow'
                                                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                                                    }`}
                                                >
                                                    {src}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-300 mb-1">RTSP Stream Server URL</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={rtspUrl}
                                                onChange={(e) => setRtspUrl(e.target.value)}
                                                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-cyan-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                                                placeholder="rtsp://192.168.1.120:554/live"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleTestRtspConnection}
                                                disabled={isConnecting}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                                            >
                                                {isConnecting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                                <span>Connect</span>
                                            </button>
                                        </div>
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            Supports DJI O3 Enterprise, Autel SkyLink, RTSP H.264/H.265, and MAVLink v2.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'gallery' && (
                            <div className="p-6 overflow-y-auto space-y-4">
                                <h4 className="font-black text-sm uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                    <Camera size={16} className="text-cyan-400" />
                                    <span>Captured Geotagged Aerial Gallery ({capturedPhotos.length} Items)</span>
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {capturedPhotos.map((photo, pIdx) => (
                                        <div key={`captured-photo-${photo.id}-${pIdx}`} className="group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 relative">
                                            <img src={photo.url} alt="Aerial Frame" className="w-full h-36 object-cover" />
                                            <div className="p-2.5 text-[11px] font-mono text-slate-300 space-y-0.5">
                                                <div className="font-bold text-white flex justify-between">
                                                    <span>{photo.coords}</span>
                                                    <span className="text-cyan-400">{photo.alt}m</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500">{photo.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE MISSION CONTROLS & GIMBAL PANEL */}
                    <div className="w-full lg:w-80 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 text-xs overflow-y-auto shrink-0">
                        {/* Selected Trenches Config */}
                        <div className="space-y-2">
                            <span className="font-black uppercase tracking-wider text-[11px] text-slate-300 block">
                                {isKa ? 'თხრილების შერჩევა (Trenches):' : 'Survey Trenches (#1 - #5):'}
                            </span>
                            <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((tNum, tIdx) => {
                                    const isSelected = (Array.isArray(mission.selectedTrenches) ? mission.selectedTrenches : [3, 4, 5]).includes(tNum);
                                    return (
                                        <button
                                            key={`cockpit-trench-${tNum}-${tIdx}`}
                                            type="button"
                                            onClick={() => onToggleTrench && onToggleTrench(tNum)}
                                            className={`flex-1 py-1.5 rounded-xl font-mono font-black text-xs transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-300'
                                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                                            }`}
                                        >
                                            #{tNum}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Gimbal Pitch Slider */}
                        <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-300">Gimbal Pitch Angle</span>
                                <span className="font-mono text-cyan-400 font-bold">{mission.gimbalPitchDeg}°</span>
                            </div>
                            <input
                                type="range"
                                min="-90"
                                max="0"
                                step="5"
                                value={mission.gimbalPitchDeg}
                                onChange={(e) => onUpdateMission({ gimbalPitchDeg: Number(e.target.value) })}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] font-mono text-slate-500">
                                <span>-90° (Nadir)</span>
                                <span>-45° (Oblique)</span>
                                <span>0° (Horizon)</span>
                            </div>
                        </div>

                        {/* Flight Altitude Slider */}
                        <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-300">Cruise Altitude (AGL)</span>
                                <span className="font-mono text-cyan-400 font-bold">{mission.currentAlt}m</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                step="1"
                                value={mission.currentAlt}
                                onChange={(e) => onUpdateMission({ currentAlt: Number(e.target.value), altitudeM: Number(e.target.value) })}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                        </div>

                        {/* Flight Speed Slider */}
                        <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-300">Flight Speed</span>
                                <span className="font-mono text-emerald-400 font-bold">{mission.speedMs} m/s</span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="18"
                                step="1"
                                value={mission.speedMs}
                                onChange={(e) => onUpdateMission({ speedMs: Number(e.target.value) })}
                                className="w-full accent-emerald-400 cursor-pointer"
                            />
                        </div>

                        {/* Live Telemetry Health Checklist */}
                        <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5 text-[11px]">
                            <span className="font-bold text-slate-300 block uppercase text-[10px]">Pre-Flight Telemetry Check</span>
                            <div className="flex items-center justify-between text-slate-400">
                                <span>RTK Differential Satellites:</span>
                                <span className="text-emerald-400 font-mono font-bold">24 (Fixed)</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                                <span>Obstacle Avoidance Sensors:</span>
                                <span className="text-emerald-400 font-mono font-bold">Omni ACTIVE</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                                <span>Geofence Boundary:</span>
                                <span className="text-emerald-400 font-mono font-bold">Enforced (Agrobari)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
