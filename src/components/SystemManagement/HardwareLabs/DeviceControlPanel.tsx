import React, { useState } from 'react';
import { 
    Move, Navigation, Compass, Sliders, RotateCw, 
    ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, 
    ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, 
    Home, Camera, Sun, Moon, RefreshCw, Radio, Check, 
    Maximize2, Zap, Shield, MapPin, Eye, Volume2, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { 
    CANONICAL_PLANTATION_NAME, 
    CANONICAL_AGROBARI_CENTER, 
    nudgeCoordinates,
    getMainPlantation 
} from '../../../utils/plantationHelper';

export interface DeviceControlCamera {
    id: string;
    name: string;
    channel: number;
    model?: string;
    ipAddress?: string;
    lat: number;
    lng: number;
    azimuthDeg?: number;
    tiltAngleDeg?: number;
    opticalZoomX?: number;
    digitalZoomX?: number;
    rangeM?: number;
    mountHeightM?: number;
    isPtz?: boolean;
    isNightVision?: boolean;
}

export interface DeviceControlPanelProps {
    camera: DeviceControlCamera;
    onUpdateCamera: (updated: Partial<DeviceControlCamera>) => void;
    onFlyToCoords?: (coords: [number, number], label?: string) => void;
    mapCenterCoords?: [number, number];
    isKa?: boolean;
    className?: string;
}

export const DeviceControlPanel: React.FC<DeviceControlPanelProps> = ({
    camera,
    onUpdateCamera,
    onFlyToCoords,
    mapCenterCoords,
    isKa = false,
    className = ''
}) => {
    // Nudge distance step: 1m, 5m, 20m
    const [nudgeStepM, setNudgeStepM] = useState<number>(5);
    
    // PTZ Speed multiplier: 1x to 8x
    const [ptzSpeed, setPtzSpeed] = useState<number>(4);

    // Auto-patrol simulation state
    const [isPatrolling, setIsPatrolling] = useState<boolean>(false);
    
    // Snapshot flash state
    const [isSnapping, setIsSnapping] = useState<boolean>(false);

    // Rebooting simulation
    const [isRebooting, setIsRebooting] = useState<boolean>(false);

    // Free drag hint toggle
    const [dragModeActive, setDragModeActive] = useState<boolean>(true);

    const azimuth = camera.azimuthDeg ?? 0;
    const tilt = camera.tiltAngleDeg ?? 4;
    const zoom = camera.opticalZoomX ?? 1;

    // Geographic Relocation (Nudge)
    const handleNudge = (direction: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW') => {
        const [nextLat, nextLng] = nudgeCoordinates(camera.lat, camera.lng, direction, nudgeStepM);
        onUpdateCamera({ lat: nextLat, lng: nextLng });
        if (onFlyToCoords) {
            onFlyToCoords([nextLat, nextLng], `კამერა #${camera.channel} გადაადგილდა ${direction} (${nudgeStepM}მ)`);
        }
        toast.info(
            isKa 
                ? `კამერა გადაადგილდა ${direction} მიმართულებით (${nudgeStepM} მ): ${nextLat.toFixed(5)}, ${nextLng.toFixed(5)}`
                : `Camera nudged ${direction} by ${nudgeStepM}m: ${nextLat.toFixed(5)}, ${nextLng.toFixed(5)}`
        );
    };

    // Active profile plantation
    const activePlantation = getMainPlantation([], mapCenterCoords || CANONICAL_AGROBARI_CENTER);

    // Relocate to active plantation center
    const handleMoveToPlantationCenter = () => {
        const target = activePlantation.center || CANONICAL_AGROBARI_CENTER;
        onUpdateCamera({ lat: target[0], lng: target[1] });
        if (onFlyToCoords) {
            onFlyToCoords(target, activePlantation.name);
        }
        toast.success(
            isKa 
                ? `კამერა #${camera.channel} გადატანილია ${activePlantation.name}-ს ცენტრში!`
                : `Camera #${camera.channel} relocated to ${activePlantation.name} center!`
        );
    };

    // Relocate to current map center
    const handleMoveToMapCenter = () => {
        if (!mapCenterCoords || !Number.isFinite(mapCenterCoords[0])) {
            handleMoveToPlantationCenter();
            return;
        }
        onUpdateCamera({ lat: mapCenterCoords[0], lng: mapCenterCoords[1] });
        toast.success(
            isKa 
                ? `კამერა #${camera.channel} გადატანილია რუკის ცენტრში (${mapCenterCoords[0].toFixed(5)}, ${mapCenterCoords[1].toFixed(5)})`
                : `Camera #${camera.channel} moved to map center (${mapCenterCoords[0].toFixed(5)}, ${mapCenterCoords[1].toFixed(5)})`
        );
    };

    // PTZ Pan adjustments
    const handlePanStep = (deltaDeg: number) => {
        const newAzimuth = (azimuth + deltaDeg + 360) % 360;
        onUpdateCamera({ azimuthDeg: Math.round(newAzimuth) });
    };

    // PTZ Tilt adjustments
    const handleTiltStep = (deltaDeg: number) => {
        const newTilt = Math.min(45, Math.max(1, tilt + deltaDeg));
        onUpdateCamera({ tiltAngleDeg: Math.round(newTilt) });
    };

    // Zoom adjustments
    const handleZoomStep = (deltaZoom: number) => {
        const newZoom = Math.min(32, Math.max(1, zoom + deltaZoom));
        onUpdateCamera({ opticalZoomX: newZoom });
    };

    // Reset PTZ to Home position
    const handleResetHome = () => {
        onUpdateCamera({ azimuthDeg: 0, tiltAngleDeg: 4, opticalZoomX: 1 });
        toast.info(isKa ? 'PTZ დაბრუნდა საწყის პოზიციაზე (ჩრდილოეთი 0°, დახრა 4°)' : 'PTZ Home Position Set (0° North, 4° Tilt)');
    };

    // Trigger Snapshot capture
    const handleTakeSnapshot = () => {
        setIsSnapping(true);
        setTimeout(() => setIsSnapping(false), 500);
        toast.success(
            isKa 
                ? `📸 კადრი შენახულია: [CH0${camera.channel}] ${camera.name} (${new Date().toLocaleTimeString()})`
                : `📸 Snapshot saved: [CH0${camera.channel}] ${camera.name} (${new Date().toLocaleTimeString()})`
        );
    };

    // Soft Reboot Camera
    const handleReboot = () => {
        setIsRebooting(true);
        toast.info(isKa ? `მოწყობილობის გადატვირთვა: CH0${camera.channel}...` : `Power cycling device: CH0${camera.channel}...`);
        setTimeout(() => {
            setIsRebooting(false);
            toast.success(isKa ? `მოწყობილობა CH0${camera.channel} წარმატებით გადაიტვირთა (RTSP Stream Active)` : `Device CH0${camera.channel} rebooted successfully (RTSP Stream Active)`);
        }, 2000);
    };

    // Quick presets on Agrobari plantation
    const AGROBARI_PRESETS = [
        { name: isKa ? 'პატარა სექტორი' : 'Small Sector', az: 0, tilt: 4, zoom: 1 },
        { name: isKa ? 'მთავარი ბაღი ბლოკი A' : 'Main Orchard A', az: 45, tilt: 6, zoom: 2 },
        { name: isKa ? 'მოცვის ტერასა' : 'Blueberry Terraces', az: 180, tilt: 8, zoom: 4 },
        { name: isKa ? 'სათბურები' : 'Greenhouses', az: 270, tilt: 5, zoom: 2 },
        { name: isKa ? 'ჩრდილოეთის ჭიშკარი' : 'North Gate', az: 315, tilt: 3, zoom: 6 },
        { name: isKa ? 'სატუმბი სადგური' : 'Pump Station', az: 90, tilt: 7, zoom: 3 },
    ];

    return (
        <div className={`p-4 bg-slate-950/95 border border-blue-500/30 rounded-3xl space-y-4 shadow-2xl backdrop-blur-xl ${className}`}>
            {/* Header: Device Identification & Moving Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-xl shrink-0">
                        <Move size={18} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                                {isKa ? 'მოწყობილობის მართვის & გადაადგილების პანელი' : 'Device Control & Movement Panel'}
                            </span>
                            <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[9px] font-bold">
                                {isKa ? 'ონლაინ' : 'ONLINE'}
                            </span>
                        </div>
                        <h3 className="text-xs font-black text-white truncate">
                            [CH0{camera.channel < 10 ? `0${camera.channel}` : camera.channel}] {camera.name}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Move to Active Profile Plantation Center Button */}
                    <button
                        type="button"
                        onClick={handleMoveToPlantationCenter}
                        className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                        title={`Move camera directly to ${activePlantation.name} center`}
                    >
                        <Navigation size={12} className="text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[170px]">🌿 {activePlantation.name}</span>
                    </button>
                </div>
            </div>

            {/* ========================================================
                SECTION 1: GEOGRAPHIC LOCATION & TERRAIN MOVING
               ======================================================== */}
            <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <MapPin size={13} />
                        {isKa ? '1. გეოგრაფიული გადაადგილება რუკაზე (Location Moving)' : '1. Geographic Relocation & Map Moving'}
                    </span>
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400">
                        <span>Lat: <b className="text-white">{camera.lat.toFixed(6)}</b></span>
                        <span className="text-slate-600">|</span>
                        <span>Lng: <b className="text-white">{camera.lng.toFixed(6)}</b></span>
                    </div>
                </div>

                {/* Move Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-slate-400 font-bold mr-1">{isKa ? 'ბიჯი:' : 'Step:'}</span>
                        {[1, 5, 20].map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setNudgeStepM(s)}
                                className={`px-2 py-1 rounded-lg font-mono font-bold transition-all cursor-pointer ${
                                    nudgeStepM === s
                                        ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                            >
                                {s} {isKa ? 'მ' : 'm'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleMoveToMapCenter}
                            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                            title="Move camera to current viewport center"
                        >
                            <TargetIcon size={11} className="text-cyan-400" />
                            <span>{isKa ? 'რუკის ცენტრში დასმა' : 'Place at Map Center'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setDragModeActive(!dragModeActive);
                                toast.info(
                                    dragModeActive 
                                        ? 'Drag mode is active: click and drag the camera pin on the map.' 
                                        : 'Drag mode locked.'
                                );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                dragModeActive 
                                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' 
                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                        >
                            <Move size={11} />
                            <span>{isKa ? '🖐️ გადათრევა რუკაზე' : '🖐️ Drag on Map'}</span>
                        </button>
                    </div>
                </div>

                {/* 8-Direction Geographic Nudge Pad */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="flex flex-col items-center justify-center p-2 bg-slate-950/70 rounded-2xl border border-slate-850">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">
                            {isKa ? 'მიკრო-გადაადგილების ჯოისტიკი (Nudge Compass)' : 'Precision Moving Compass (Nudge Pad)'}
                        </span>
                        
                        <div className="grid grid-cols-3 gap-1.5 w-36 h-36">
                            <button
                                type="button"
                                onClick={() => handleNudge('NW')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                                title="Nudge Northwest"
                            >
                                <ArrowUpLeft size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('N')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-amber-400 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer font-black active:scale-90"
                                title="Nudge North (+Lat)"
                            >
                                <ArrowUp size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('NE')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                                title="Nudge Northeast"
                            >
                                <ArrowUpRight size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNudge('W')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-amber-400 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer font-black active:scale-90"
                                title="Nudge West (-Lng)"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={handleMoveToMapCenter}
                                className="p-2 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-400 rounded-xl border border-emerald-600/60 flex flex-col items-center justify-center transition-all cursor-pointer font-black shadow-inner active:scale-90"
                                title="Center on Agrobari"
                            >
                                <span className="text-[9px] font-black leading-none">🌿</span>
                                <span className="text-[7px] uppercase font-mono mt-0.5">AGRO</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('E')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-amber-400 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer font-black active:scale-90"
                                title="Nudge East (+Lng)"
                            >
                                <ArrowRight size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNudge('SW')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                                title="Nudge Southwest"
                            >
                                <ArrowDownLeft size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('S')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-amber-400 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer font-black active:scale-90"
                                title="Nudge South (-Lat)"
                            >
                                <ArrowDown size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNudge('SE')}
                                className="p-2 bg-slate-900 hover:bg-amber-600/40 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                                title="Nudge Southeast"
                            >
                                <ArrowDownRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Numeric Coordinates Direct Edit */}
                    <div className="space-y-2 p-2 bg-slate-950/70 rounded-2xl border border-slate-850">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            {isKa ? 'ზუსტი კოორდინატების ჩაწერა (Direct GPS Input)' : 'Direct GPS Coordinates Input'}
                        </span>
                        
                        <div className="space-y-1.5">
                            <div>
                                <label className="text-[9px] text-slate-400 font-mono block">Latitude (°N)</label>
                                <input
                                    type="number"
                                    step="0.00005"
                                    value={camera.lat}
                                    onChange={(e) => onUpdateCamera({ lat: parseFloat(e.target.value) || camera.lat })}
                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-400 font-mono block">Longitude (°E)</label>
                                <input
                                    type="number"
                                    step="0.00005"
                                    value={camera.lng}
                                    onChange={(e) => onUpdateCamera({ lng: parseFloat(e.target.value) || camera.lng })}
                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="pt-1 text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                            <Info size={11} className="text-blue-400 shrink-0" />
                            <span>{isKa ? 'რუკაზე პინის გადათრევა ავტომატურად ანახლებს კოორდინატებს' : 'Dragging pin on map updates coordinates automatically'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================
                SECTION 2: PTZ OPTICAL ORIENTATION (PAN / TILT / ZOOM)
               ======================================================== */}
            <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Compass size={13} />
                        {isKa ? '2. ოპტიკური PTZ მართვა (Pan / Tilt / Zoom)' : '2. Optical PTZ Controls (Pan / Tilt / Zoom)'}
                    </span>
                    <button
                        type="button"
                        onClick={handleResetHome}
                        className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Reset PTZ to 0° North"
                    >
                        <Home size={11} />
                        <span>Home</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Pan Azimuth Rotation */}
                    <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-850 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-300 flex items-center gap-1">
                                <RotateCw size={12} className="text-blue-400" />
                                {isKa ? 'აზიმუტი (Pan Rotation)' : 'Pan Rotation (Azimuth)'}
                            </span>
                            <span className="text-blue-400 font-mono font-black">{azimuth}°</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handlePanStep(-15)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                -15°
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePanStep(-5)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                -5°
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="359"
                                value={azimuth}
                                onChange={(e) => onUpdateCamera({ azimuthDeg: Number(e.target.value) })}
                                className="flex-1 accent-blue-500 cursor-pointer"
                            />
                            <button
                                type="button"
                                onClick={() => handlePanStep(5)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                +5°
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePanStep(15)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                +15°
                            </button>
                        </div>
                    </div>

                    {/* Vertical Tilt Angle */}
                    <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-850 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-300 flex items-center gap-1">
                                <Sliders size={12} className="text-amber-400" />
                                {isKa ? 'დახრა (Tilt Pitch)' : 'Tilt Pitch (Vertical)'}
                            </span>
                            <span className="text-amber-400 font-mono font-black">{tilt}°</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleTiltStep(-5)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                -5°
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTiltStep(-1)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                -1°
                            </button>
                            <input
                                type="range"
                                min="1"
                                max="45"
                                value={tilt}
                                onChange={(e) => onUpdateCamera({ tiltAngleDeg: Number(e.target.value) })}
                                className="flex-1 accent-amber-500 cursor-pointer"
                            />
                            <button
                                type="button"
                                onClick={() => handleTiltStep(1)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                +1°
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTiltStep(5)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
                            >
                                +5°
                            </button>
                        </div>
                    </div>
                </div>

                {/* Zoom Controls & Patrol Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                            <ZoomIn size={12} className="text-cyan-400" />
                            {isKa ? 'ოპტიკური ზუმი:' : 'Optical Zoom:'}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleZoomStep(-1)}
                                className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                            >
                                <ZoomOut size={12} />
                            </button>
                            <span className="px-2 py-0.5 bg-slate-950 font-mono font-black text-cyan-400 text-xs rounded-lg border border-slate-800">
                                {zoom}x
                            </span>
                            <button
                                type="button"
                                onClick={() => handleZoomStep(1)}
                                className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                            >
                                <ZoomIn size={12} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsPatrolling(!isPatrolling);
                                toast.info(
                                    !isPatrolling 
                                        ? '🔄 360° Auto-Patrol activated (Scanning rows)' 
                                        : 'Patrol stopped.'
                                );
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isPatrolling 
                                    ? 'bg-emerald-600 text-white animate-pulse' 
                                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                        >
                            <RefreshCw size={12} className={isPatrolling ? 'animate-spin' : ''} />
                            <span>{isKa ? '360° პატრულირება' : '360° Auto-Patrol'}</span>
                        </button>
                    </div>
                </div>

                {/* Quick Presets for Agrobari Sectors */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                        {isKa ? 'აგრობარი-ს სექტორული პრე-სეტები (Quick Presets):' : 'Agrobari Sector Presets:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {AGROBARI_PRESETS.map((p, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    onUpdateCamera({ azimuthDeg: p.az, tiltAngleDeg: p.tilt, opticalZoomX: p.zoom });
                                    toast.success(`${isKa ? 'პოზიცია შეიცვალა:' : 'Preset loaded:'} ${p.name}`);
                                }}
                                className="px-2.5 py-1 bg-slate-950 hover:bg-blue-900/40 text-slate-300 hover:text-blue-300 border border-slate-800 hover:border-blue-500/50 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                                🎯 {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================================================
                SECTION 3: HARDWARE OPERATIONS (SNAPSHOT, IR, REBOOT)
               ======================================================== */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleTakeSnapshot}
                        disabled={isSnapping}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSnapping 
                                ? 'bg-white text-slate-950 scale-105' 
                                : 'bg-slate-800 hover:bg-slate-700 text-white'
                        }`}
                    >
                        <Camera size={13} />
                        <span>{isKa ? 'სურათის გადაღება' : 'Snapshot'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            const nextNight = !camera.isNightVision;
                            onUpdateCamera({ isNightVision: nextNight });
                            toast.info(nextNight ? '🌙 ColorVu / IR Night Mode: ON' : '☀️ Day Mode: ON');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            camera.isNightVision 
                                ? 'bg-indigo-950 text-indigo-300 border-indigo-700' 
                                : 'bg-slate-800 text-amber-300 border-slate-700'
                        }`}
                    >
                        {camera.isNightVision ? <Moon size={13} /> : <Sun size={13} />}
                        <span>{camera.isNightVision ? 'Night / IR' : 'Day Mode'}</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleReboot}
                        disabled={isRebooting}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Reboot Camera Device"
                    >
                        <Zap size={13} className={isRebooting ? 'text-amber-400 animate-spin' : ''} />
                        <span>{isRebooting ? 'Rebooting...' : (isKa ? 'გადატვირთვა' : 'Reboot')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Fallback target icon
const TargetIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="22" y1="12" x2="18" y2="12"/>
        <line x1="6" y1="12" x2="2" y2="12"/>
        <line x1="12" y1="6" x2="12" y2="2"/>
        <line x1="12" y1="22" x2="12" y2="18"/>
    </svg>
);
