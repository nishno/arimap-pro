import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Play, Pause, RotateCcw, Video, Square, Download, Trash2, 
    Layers, Compass, Battery, Radio, Eye, Sliders, ChevronUp, ChevronDown,
    Maximize2, Minimize2, ArrowUpRight, Camera, Check, AlertCircle, Sparkles
} from 'lucide-react';
import { safeStorage } from '../services/storageService';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface SavedDroneRecording {
    id: string;
    timestamp: number;
    title: string;
    durationSec: number;
    cameraMode: 'rgb' | 'ndvi' | 'thermal';
    resolution: string;
    fps: number;
    altitudeMeters: number;
    avgSpeedMps: number;
    fileSizeBytes: number;
    thumbnailDataUrl?: string;
    notes?: string;
}

interface DroneCameraWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onUnfoldConfig?: () => void;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onReset: () => void;
    currentProgress: number; // 0-100
    currentWaypointIdx: number;
    totalWaypoints: number;
    altitude: number;
    speed: number;
    activeCoords?: [number, number];
    cameraMode: 'rgb' | 'ndvi' | 'thermal';
    onSetCameraMode: (mode: 'rgb' | 'ndvi' | 'thermal') => void;
    savedRecordings: SavedDroneRecording[];
    onSaveRecording: (rec: SavedDroneRecording) => void;
    onDeleteRecording: (id: string) => void;
}

export const DroneCameraWindow: React.FC<DroneCameraWindowProps> = ({
    isOpen,
    onClose,
    onUnfoldConfig,
    isPlaying,
    onTogglePlay,
    onReset,
    currentProgress,
    currentWaypointIdx,
    totalWaypoints,
    altitude,
    speed,
    activeCoords = [41.7151, 44.8271],
    cameraMode,
    onSetCameraMode,
    savedRecordings,
    onSaveRecording,
    onDeleteRecording
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    // Window state: position, size, transparency, minimized
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [transparency, setTransparency] = useState<number>(() => {
        const saved = safeStorage.getItem('agrimap_drone_camera_transparency');
        return saved ? Number(saved) : 95;
    });
    const [showTransparencyMenu, setShowTransparencyMenu] = useState<boolean>(false);
    const [customOpacityInput, setCustomOpacityInput] = useState<string>(String(transparency));

    // Recording states
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingSec, setRecordingSec] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<'feed' | 'recordings'>('feed');
    const [selectedPlaybackRec, setSelectedPlaybackRec] = useState<SavedDroneRecording | null>(null);

    // Canvas simulation
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const recordTimerRef = useRef<any>(null);

    // Dragging logic
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, canvas')) return;
        isDraggingRef.current = true;
        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
        if (rect) {
            dragOffsetRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const newX = Math.max(10, Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 200, e.clientY - dragOffsetRef.current.y));
        setPos({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}
    };

    // Recording timer
    useEffect(() => {
        if (isRecording) {
            recordTimerRef.current = setInterval(() => {
                setRecordingSec(s => s + 1);
            }, 1000);
        } else {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
            setRecordingSec(0);
        }
        return () => {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, [isRecording]);

    // Handle Start / Stop Record
    const handleToggleRecording = () => {
        if (!isRecording) {
            setIsRecording(true);
            toast.success(isKa ? "🔴 დრონის FPV ჩაწერა დაიწყო!" : "🔴 Live Drone FPV recording started!");
        } else {
            // Stop and generate thumbnail
            let thumbUrl = '';
            if (canvasRef.current) {
                try {
                    thumbUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
                } catch (_) {}
            }

            const newRec: SavedDroneRecording = {
                id: `rec-${Date.now()}`,
                timestamp: Date.now(),
                title: isKa 
                    ? `აეროგადაღება ${cameraMode.toUpperCase()} (${recordingSec}წმ)` 
                    : `Survey Mission ${cameraMode.toUpperCase()} (${recordingSec}s)`,
                durationSec: Math.max(1, recordingSec),
                cameraMode: cameraMode,
                resolution: '4K Ultra-HD (3840x2160)',
                fps: 60,
                altitudeMeters: altitude,
                avgSpeedMps: speed,
                fileSizeBytes: Math.round(recordingSec * 2.8 * 1024 * 1024), // ~2.8MB/s
                thumbnailDataUrl: thumbUrl,
                notes: `Captured in ${cameraMode.toUpperCase()} multispectral mode at ${altitude}m AGL.`
            };

            onSaveRecording(newRec);
            setIsRecording(false);
            toast.success(isKa ? `🎬 ჩანაწერი შენახულია: ${newRec.title} (${(newRec.fileSizeBytes / (1024*1024)).toFixed(1)} MB)` : `🎬 Recording saved: ${newRec.title} (${(newRec.fileSizeBytes / (1024*1024)).toFixed(1)} MB)`);
        }
    };

    // Realistic Drone Camera Simulation Render Loop
    useEffect(() => {
        let isCancelled = false;
        let frame = 0;

        const render = () => {
            if (isCancelled) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            frame++;
            const w = canvas.width || 480;
            const h = canvas.height || 270;

            try {
                ctx.clearRect(0, 0, w, h);

                // 1. Terrain Base
                if (cameraMode === 'rgb') {
                    // Natural agricultural terrain
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, '#3a5f2d');
                    grad.addColorStop(0.5, '#477337');
                    grad.addColorStop(1, '#2f4f22');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    // Planted tree rows / trench lines
                    ctx.strokeStyle = '#27411c';
                    ctx.lineWidth = 14;
                    const offset = (frame * (isPlaying ? speed * 0.2 : 0.3)) % 40;
                    for (let x = -50; x < w + 80; x += 42) {
                        ctx.beginPath();
                        ctx.moveTo(x + offset * 0.4, 0);
                        ctx.lineTo(x - 20 + offset * 0.4, h);
                        ctx.stroke();

                        // Seedling dots on row
                        for (let y = 15; y < h; y += 32) {
                            ctx.fillStyle = '#65a30d';
                            ctx.beginPath();
                            ctx.arc(x + offset * 0.4 - (y / h) * 20, y, 6, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.fillStyle = '#84cc16';
                            ctx.beginPath();
                            ctx.arc(x + offset * 0.4 - (y / h) * 20 - 1, y - 1, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                } else if (cameraMode === 'ndvi') {
                    // NDVI False Color (Green = High Vigor, Yellow = Moderate, Red = Water/Pest Stress)
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, '#15803d');
                    grad.addColorStop(0.4, '#84cc16');
                    grad.addColorStop(0.7, '#eab308');
                    grad.addColorStop(1, '#ef4444');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    // NDVI heatmap noise texture
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                    for (let i = 0; i < 40; i++) {
                        const rx = (i * 37 + frame * 0.5) % w;
                        const ry = (i * 29) % h;
                        ctx.beginPath();
                        ctx.arc(rx, ry, 18, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    // Thermal IR (Ironbow: Dark Blue -> Purple -> Orange -> White)
                    const grad = ctx.createLinearGradient(0, 0, 0, h);
                    grad.addColorStop(0, '#1e1b4b');
                    grad.addColorStop(0.3, '#581c87');
                    grad.addColorStop(0.6, '#ea580c');
                    grad.addColorStop(0.9, '#fde047');
                    grad.addColorStop(1, '#ffffff');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    // Thermal canopy spots
                    ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
                    for (let x = 20; x < w; x += 50) {
                        for (let y = 20; y < h; y += 40) {
                            ctx.beginPath();
                            ctx.arc(x + Math.sin(frame * 0.05 + x) * 4, y, 12, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                // 2. FPV HUD Graphics Overlay
                const cx = w / 2;
                const cy = h / 2;

                // Pitch ladder & Artificial Horizon
                const rollAngle = Math.sin(frame * 0.03) * 0.05;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rollAngle);

                // Center reticle
                ctx.strokeStyle = '#00ffcc';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-18, 0);
                ctx.lineTo(-6, 0);
                ctx.moveTo(6, 0);
                ctx.lineTo(18, 0);
                ctx.moveTo(0, -18);
                ctx.lineTo(0, -6);
                ctx.moveTo(0, 6);
                ctx.lineTo(0, 18);
                ctx.stroke();

                // Reticle box
                ctx.strokeRect(-4, -4, 8, 8);

                // Pitch lines
                ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)';
                ctx.beginPath();
                ctx.moveTo(-35, -25);
                ctx.lineTo(35, -25);
                ctx.moveTo(-25, 25);
                ctx.lineTo(25, 25);
                ctx.stroke();
                ctx.restore();

                // 3. Compass ribbon at top
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(cx - 70, 8, 140, 18);
                ctx.strokeStyle = '#00ffcc';
                ctx.strokeRect(cx - 70, 8, 140, 18);
                ctx.fillStyle = '#00ffcc';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                const heading = Math.round((45 + Math.sin(frame * 0.02) * 8 + 360) % 360);
                ctx.fillText(`${heading.toString().padStart(3, '0')}° N-NE`, cx, 21);

                // 4. Photogrammetry Scanning Line Sweep
                const sweepY = (frame * 3) % h;
                ctx.strokeStyle = cameraMode === 'ndvi' ? 'rgba(74, 222, 128, 0.7)' : cameraMode === 'thermal' ? 'rgba(251, 146, 60, 0.7)' : 'rgba(56, 189, 248, 0.7)';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(0, sweepY);
                ctx.lineTo(w, sweepY);
                ctx.stroke();
                ctx.setLineDash([]);

                // 5. Live Recording Watermark
                if (isRecording) {
                    const isBlink = Math.floor(frame / 20) % 2 === 0;
                    if (isBlink) {
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath();
                        ctx.arc(20, 20, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'left';
                    const mins = String(Math.floor(recordingSec / 60)).padStart(2, '0');
                    const secs = String(recordingSec % 60).padStart(2, '0');
                    ctx.fillText(`REC [${mins}:${secs}] 4K-60FPS`, 30, 24);
                }
            } catch (renderErr) {
                // Safeguard against canvas context disposal during mode/unmount changes
            }

            if (!isCancelled) {
                animFrameRef.current = requestAnimationFrame(render);
            }
        };

        if (isOpen && !isMinimized && activeTab === 'feed') {
            animFrameRef.current = requestAnimationFrame(render);
        }

        return () => {
            isCancelled = true;
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [isOpen, isMinimized, activeTab, cameraMode, isPlaying, speed, altitude, isRecording, recordingSec]);

    if (!isOpen) return null;

    const handleSetTransparency = (val: number) => {
        const clamped = Math.max(10, Math.min(100, val));
        setTransparency(clamped);
        setCustomOpacityInput(String(clamped));
        safeStorage.setItem('agrimap_drone_camera_transparency', String(clamped));
    };

    return (
        <div 
            style={{
                position: 'fixed',
                zIndex: 9999,
                opacity: transparency / 100,
                ...(pos 
                    ? { left: `${pos.x}px`, top: `${pos.y}px` } 
                    : { right: '1.5rem', bottom: '1.5rem' }
                )
            }}
            className="pointer-events-auto select-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
        >
            <div className="w-[360px] sm:w-[420px] max-w-[calc(100vw-24px)] bg-slate-950/95 backdrop-blur-2xl border border-sky-500/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col text-slate-100">
                
                {/* Header (Movable Handle + Controls) */}
                <div 
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 cursor-grab active:cursor-grabbing"
                    title={isKa ? "გადაადგილებისთვის დააჭირეთ და გადაათრიეთ" : "Hold and drag to move camera window anywhere"}
                >
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1">
                                <span>{isKa ? "🚁 დრონის ცოცხალი FPV" : "🚁 Drone Live FPV"}</span>
                                <span className="text-[9px] px-1.5 py-0.2 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-md font-mono">
                                    {cameraMode.toUpperCase()}
                                </span>
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                                WP {currentWaypointIdx + 1}/{totalWaypoints} • {currentProgress}%
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Transparency % Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowTransparencyMenu(!showTransparencyMenu)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white rounded-lg text-[10px] font-mono font-black border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                                title={isKa ? "ფანჯრის გამჭვირვალობის რეგულირება" : "Adjust window transparency by percent"}
                            >
                                <Eye size={12} />
                                <span>{transparency}%</span>
                            </button>

                            {showTransparencyMenu && (
                                <div className="absolute right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-2.5 shadow-2xl w-48 space-y-2 text-xs">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                                        <span>{isKa ? "გამჭვირვალობა" : "Window Opacity"}</span>
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
                                    <div className="flex items-center gap-1">
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
                                            className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white font-mono"
                                            placeholder="%"
                                        />
                                        <div className="flex gap-1 flex-1">
                                            {[100, 75, 50, 25].map(p => (
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
                                </div>
                            )}
                        </div>

                        {/* Unfold / Expand Configuration Button */}
                        {onUnfoldConfig && (
                            <button
                                onClick={onUnfoldConfig}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title={isKa ? "დრონის მისიის სრული ფანჯრის გაშლა" : "Unfold full Drone Mission Configuration Window"}
                            >
                                <ArrowUpRight size={14} />
                            </button>
                        )}

                        {/* Minimize / Fold View */}
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title={isMinimized ? (isKa ? "კამერის HUD გაშლა" : "Expand Camera HUD") : (isKa ? "კამერის HUD ჩაკეცვა" : "Fold Camera HUD")}
                        >
                            {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {/* Close Window */}
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                            title={isKa ? "კამერის დახურვა" : "Close Camera View"}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Tab Switcher: Live Camera View vs Saved Recordings */}
                        <div className="flex border-b border-slate-800/80 bg-slate-950/70 text-[10px] font-black uppercase tracking-wider">
                            <button
                                onClick={() => setActiveTab('feed')}
                                className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'feed'
                                        ? 'border-sky-500 text-sky-300 bg-sky-500/10'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Camera size={12} />
                                <span>{isKa ? "პირდაპირი FPV" : "Live FPV Feed"}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('recordings')}
                                className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'recordings'
                                        ? 'border-sky-500 text-sky-300 bg-sky-500/10'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Video size={12} />
                                <span>{isKa ? "ჩანაწერები" : "Recordings"} ({savedRecordings.length})</span>
                            </button>
                        </div>

                        {activeTab === 'feed' ? (
                            <div className="p-3 space-y-3">
                                {/* FPV Canvas Viewport */}
                                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                                    <canvas
                                        ref={canvasRef}
                                        width={480}
                                        height={270}
                                        className="w-full h-full object-cover block"
                                    />

                                    {/* Real-time Telemetry Ribbons */}
                                    <div className="absolute top-2 left-2 pointer-events-none flex flex-col gap-0.5 font-mono text-[9px] text-sky-300 bg-slate-950/70 backdrop-blur-md px-2 py-1 rounded-lg border border-sky-500/30">
                                        <span>{isKa ? "სიმაღლე" : "ALT"}: {altitude}m AGL</span>
                                        <span>{isKa ? "სიჩქარე" : "SPD"}: {speed} m/s</span>
                                    </div>

                                    <div className="absolute top-2 right-2 pointer-events-none flex flex-col gap-0.5 font-mono text-[9px] text-emerald-400 bg-slate-950/70 backdrop-blur-md px-2 py-1 rounded-lg border border-emerald-500/30 text-right">
                                        <span>{isKa ? "ბატარეა" : "BAT"}: 94% [28m]</span>
                                        <span>{isKa ? "თანამგზავრები" : "SATS"}: 18 (GPS 3D)</span>
                                    </div>

                                    <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex items-center justify-between font-mono text-[9px] text-slate-300 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-800">
                                        <span>POS: {activeCoords[0].toFixed(5)}, {activeCoords[1].toFixed(5)}</span>
                                        <span className="text-amber-400">{cameraMode.toUpperCase()} {isKa ? "სენსორი" : "SENSOR"}</span>
                                    </div>
                                </div>

                                {/* Controls Row: Sensor Switcher, Record Button, Flight Play/Pause */}
                                <div className="flex items-center justify-between gap-2">
                                    {/* Camera Mode Toggles */}
                                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
                                        {(['rgb', 'ndvi', 'thermal'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => onSetCameraMode(mode)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                    cameraMode === mode
                                                        ? 'bg-sky-600 text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Record Button */}
                                    <button
                                        onClick={handleToggleRecording}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                                            isRecording
                                                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                                                : 'bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-rose-500/40'
                                        }`}
                                    >
                                        {isRecording ? <Square size={12} fill="white" /> : <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />}
                                        <span>{isRecording ? (isKa ? 'შეჩერება' : 'Stop REC') : (isKa ? 'ჩაწერა' : 'Record')}</span>
                                    </button>

                                    {/* Play / Pause Simulator */}
                                    <button
                                        onClick={onTogglePlay}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                            isPlaying
                                                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                                        }`}
                                    >
                                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                        <span>{isPlaying ? (isKa ? 'პაუზა' : 'Pause') : (isKa ? 'ფრენა' : 'Fly')}</span>
                                    </button>

                                    <button
                                        onClick={onReset}
                                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                                        title={isKa ? "ფრენის პოზიციის გადატვირთვა" : "Reset Flight Position"}
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Saved Recordings List */
                            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {savedRecordings.length === 0 ? (
                                    <div className="py-8 text-center space-y-1.5">
                                        <Video size={24} className="mx-auto text-slate-600" />
                                        <p className="text-xs font-bold text-slate-400">
                                            {isKa ? "ვიდეოჩანაწერები ჯერ არ არის." : "No recordings captured yet."}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                            {isKa 
                                                ? "დააჭირეთ «ჩაწერას» ფრენის დროს ვიდეომასალის შესანახად."
                                                : "Click \"Record\" while the drone is in flight to save high-res footage."}
                                        </p>
                                    </div>
                                ) : (
                                    savedRecordings.map(rec => (
                                        <div 
                                            key={rec.id}
                                            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-3 hover:border-sky-500/40 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {rec.thumbnailDataUrl ? (
                                                    <img 
                                                        src={rec.thumbnailDataUrl} 
                                                        alt="Thumbnail" 
                                                        className="w-12 h-8 rounded-lg object-cover border border-slate-700 shrink-0" 
                                                    />
                                                ) : (
                                                    <div className="w-12 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                                        <Video size={14} />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <h5 className="text-[11px] font-bold text-slate-200 truncate">{rec.title}</h5>
                                                    <p className="text-[9px] text-slate-400 font-mono">
                                                        {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {rec.durationSec}{isKa ? 'წმ' : 's'} • {(rec.fileSizeBytes / (1024*1024)).toFixed(1)}MB
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        const jsonStr = JSON.stringify(rec, null, 2);
                                                        const blob = new Blob([jsonStr], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `${rec.title.replace(/\s+/g, '_')}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                        toast.success(isKa ? "ფრენის ტელემეტრია და მეტამონაცემები ექსპორტირებულია!" : "Flight telemetry and clip metadata exported!");
                                                    }}
                                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                    title={isKa ? "ჩანაწერის ფაილის ჩამოტვირთვა" : "Download Recording File"}
                                                >
                                                    <Download size={13} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onDeleteRecording(rec.id);
                                                        toast.success(isKa ? "ჩანაწერი წაშლილია" : "Recording deleted");
                                                    }}
                                                    className="p-1.5 bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                                                    title={isKa ? "ჩანაწერის წაშლა" : "Delete Recording"}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};

export default DroneCameraWindow;
