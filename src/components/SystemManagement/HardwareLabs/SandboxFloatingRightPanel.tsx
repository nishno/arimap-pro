import React, { useState, useRef } from 'react';
import { 
    Mountain, Plus, Trash2, X, Sparkles, Satellite, 
    Layers, RefreshCw, ChevronRight, Activity, Sliders,
    GripVertical, RotateCcw, ChevronUp, ChevronDown, Undo2
} from 'lucide-react';
import type { HillSpineProfile, SpineControlPoint } from '../../../utils/demTerrainViewshed';

interface SandboxFloatingRightPanelProps {
    isOpen: boolean;
    onClose: () => void;
    hillSpineProfile: HillSpineProfile;
    activePoint: SpineControlPoint;
    activePointId: string;
    onSelectPointId: (id: string) => void;
    onUpdateActivePoint: (patch: Partial<SpineControlPoint>) => void;
    onAddSpinePoint: () => void;
    onInsertSpinePointAtMidpoint: () => void;
    onDeleteSpinePoint: (id: string) => void;
    onDeleteLastPoint?: () => void;
    canDeleteLastPoint?: boolean;
    onStartDrawSlope?: () => void;
    onFitSlopeToOrchard?: () => void;
    onClearSlope?: () => void;
    onDeleteWholeSlope?: () => void;
    measuredHillLengthM: number;
    moundMetrics: { maxH: number; minH: number; avgWidth: number; maxWidth: number };
    isAiSlopeScanning: boolean;
    onAiAutoDetectSlope: () => void;
    onLoadSatelliteDem: () => void;
    baseElevationM?: number;
    isKa?: boolean;
}

export const SandboxFloatingRightPanel: React.FC<SandboxFloatingRightPanelProps> = ({
    isOpen,
    onClose,
    hillSpineProfile,
    activePoint,
    activePointId,
    onSelectPointId,
    onUpdateActivePoint,
    onAddSpinePoint,
    onInsertSpinePointAtMidpoint,
    onDeleteSpinePoint,
    onDeleteLastPoint,
    canDeleteLastPoint,
    onStartDrawSlope,
    onFitSlopeToOrchard,
    onClearSlope,
    onDeleteWholeSlope,
    measuredHillLengthM,
    moundMetrics,
    isAiSlopeScanning,
    onAiAutoDetectSlope,
    onLoadSatelliteDem,
    baseElevationM = 480,
    isKa = false
}) => {
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
            startLeft: rect ? rect.left : (window.innerWidth - 440),
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

    if (!isOpen) return null;

    const estimatedVolumeM3 = Math.round(measuredHillLengthM * (moundMetrics.avgWidth || 45) * Math.max(1, moundMetrics.maxH || 25) * 0.42);

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
            className={`z-[1200] w-92 sm:w-[420px] max-w-[calc(100vw-24px)] bg-slate-950/95 border border-cyan-500/50 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 ${
                panelPos ? '' : 'absolute right-3 top-16 bottom-4'
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
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <div>
                        <h4 className="font-black text-xs sm:text-sm text-cyan-300 uppercase tracking-tight flex items-center gap-1.5">
                            <Mountain size={15} className="text-cyan-400" />
                            {isKa ? '3D რელიეფის & ქედის მოდელირება' : '3D Mound & Slope Sculptor'}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                            {hillSpineProfile.points.length} Cross-Sections • 3D Terrain Extrusion
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {panelPos && (
                        <button
                            type="button"
                            onClick={() => setPanelPos(null)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            title="Reset position to right"
                        >
                            <RotateCcw size={12} />
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
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs text-slate-200">
                {/* PROMINENT SLOPE LENGTH STAT CARD */}
                <div className="p-3 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border border-amber-500/60 rounded-2xl flex items-center justify-between shadow-lg">
                    <div>
                        <span className="text-[10px] text-amber-300/90 font-black uppercase tracking-wider block">
                            {isKa ? 'ქედის სიგრძე (Slope Spine Length)' : 'Measured Slope Length (Line)'}
                        </span>
                        <span className="text-2xl font-mono font-black text-amber-300 tracking-tight">
                            {measuredHillLengthM} m
                        </span>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-400 space-y-0.5">
                        <div className="text-slate-300 font-bold">{hillSpineProfile.points.length} Cross-Sections</div>
                        <div className="text-cyan-400">Vol: ~{estimatedVolumeM3.toLocaleString()} m³</div>
                        <div className="text-emerald-400">Avg W: {moundMetrics.avgWidth}m</div>
                    </div>
                </div>

                {/* AXIAL POINTS & WIDTH CROSS-SECTION SELECTOR */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {isKa ? 'განივი ხაზები & წერტილები:' : 'Cross-Section Points & Lines:'}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={onInsertSpinePointAtMidpoint}
                                className="px-2 py-0.5 bg-blue-900/70 hover:bg-blue-800 text-blue-200 border border-blue-600/50 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title={isKa ? 'შუა წერტილის ჩასმა ფერდობის დასაყოფად' : 'Insert cross-section point at midpoint'}
                            >
                                <Plus size={10} />
                                <span>Midpoint</span>
                            </button>
                            <button
                                type="button"
                                onClick={onAddSpinePoint}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow"
                                title={isKa ? 'ახალი საკვანძო წერტილის დამატება' : 'Add new cross-section point to slope'}
                            >
                                <Plus size={10} className="stroke-[3]" />
                                <span>+ Point</span>
                            </button>
                            {onDeleteLastPoint && (
                                <button
                                    type="button"
                                    onClick={onDeleteLastPoint}
                                    disabled={!canDeleteLastPoint && hillSpineProfile.points.length === 0}
                                    className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={isKa ? 'ბოლო წერტილის წაშლა (Backspace / ⌫ ან Back)' : 'Delete last edited point (Backspace / ⌫ or Back)'}
                                >
                                    <Undo2 size={10} className="stroke-[2.5]" />
                                    <span>{isKa ? 'უკან' : 'Back'} ⌫</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Slope Workflow Buttons */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
                        {onStartDrawSlope && (
                            <button
                                type="button"
                                onClick={onStartDrawSlope}
                                className="flex-1 py-1 px-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow"
                                title="Click directly on map to drop points A, B, C..."
                            >
                                <span>✏️ {isKa ? 'რუკაზე დახატვა' : 'Click-to-Draw on Map'}</span>
                            </button>
                        )}
                        {onFitSlopeToOrchard && (
                            <button
                                type="button"
                                onClick={onFitSlopeToOrchard}
                                className="py-1 px-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title="Auto-place slope along orchard axis (A:10m, B:70m, C:5m)"
                            >
                                <span>🌱 {isKa ? 'მორგება' : 'Fit Orchard'}</span>
                            </button>
                        )}
                        {(onDeleteWholeSlope || onClearSlope) && (
                            <button
                                type="button"
                                onClick={onDeleteWholeSlope || onClearSlope}
                                className="py-1 px-2.5 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title={isKa ? 'მთელი რელიეფის წაშლა' : 'Delete whole slope'}
                            >
                                <Trash2 size={11} className="text-red-400" />
                                <span>{isKa ? 'წაშლა' : 'Delete Slope'}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {hillSpineProfile.points.map((pt, idx) => {
                            const isSelected = pt.id === activePointId;
                            const letter = String.fromCharCode(65 + idx);
                            const isMid = idx === Math.floor(hillSpineProfile.points.length / 2);
                            return (
                                <button
                                    key={`sculpt-pt-${pt.id}-${idx}`}
                                    type="button"
                                    onClick={() => onSelectPointId(pt.id)}
                                    className={`px-2.5 py-1 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300'
                                            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{letter}</span>
                                    {isMid && <span className="text-[8px] px-1 bg-amber-950 text-amber-300 rounded font-sans font-bold">Apex</span>}
                                    <span className="text-[9px] opacity-80">{pt.peakHeightM > 0 ? `+${pt.peakHeightM}` : pt.peakHeightM}m</span>
                                    <span className="text-[8px] text-cyan-300">W:{pt.widthM}m</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ACTIVE POINT PARAMETERS: HEIGHT (MIDPOINT) & WIDTH LINES */}
                <div className="space-y-3 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-[11px]">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                        <span className="font-bold text-white font-mono flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            {activePoint.name}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => onDeleteSpinePoint(activePoint.id)}
                                className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                                title={isKa ? 'ამ წერტილის წაშლა' : 'Delete this connection point'}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>

                    {/* 1. PEAK HEIGHT / MIDPOINT ELEVATION SLIDER (GENERATING 3D MOUND) */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">
                                {isKa ? 'პიკის სიმაღლე / ამაღლება (Peak Height H)' : 'Midpoint Peak Height / 3D Elevation (H)'}
                            </span>
                            <span className="text-cyan-400 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                                {activePoint.peakHeightM > 0 ? `+${activePoint.peakHeightM}` : activePoint.peakHeightM} m
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
                        {/* Quick Nudge Buttons for Height */}
                        <div className="flex items-center gap-1 mt-1.5">
                            {[-5, -1, 1, 5].map(delta => (
                                <button
                                    key={`delta-${delta}`}
                                    type="button"
                                    onClick={() => onUpdateActivePoint({ peakHeightM: activePoint.peakHeightM + delta })}
                                    className="flex-1 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono text-[10px] font-bold transition-all cursor-pointer"
                                >
                                    {delta > 0 ? `+${delta}m` : `${delta}m`}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                            <button
                                type="button"
                                onClick={() => onUpdateActivePoint({ peakHeightM: Math.abs(activePoint.peakHeightM) || 30 })}
                                className={`flex-1 py-1 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                                    activePoint.peakHeightM >= 0
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600/50'
                                        : 'bg-slate-950 text-slate-400 border-slate-800'
                                }`}
                            >
                                ⛰️ Convex (+H 3D Mound)
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdateActivePoint({ peakHeightM: -Math.abs(activePoint.peakHeightM || 15) })}
                                className={`flex-1 py-1 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                                    activePoint.peakHeightM < 0
                                        ? 'bg-cyan-950 text-cyan-300 border-cyan-600/50'
                                        : 'bg-slate-950 text-slate-400 border-slate-800'
                                }`}
                            >
                                🕳️ Concave (-H Ravine)
                            </button>
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1">
                            Base: {baseElevationM}m ASL • Peak: <strong className="text-cyan-300">{baseElevationM + activePoint.peakHeightM}m ASL</strong>
                        </span>
                    </div>

                    {/* 2. CROSS-SECTION WIDTH LINE (DEFINING WIDTH USING LINES) */}
                    <div className="pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">
                                {isKa ? 'განივი ხაზის სიგანე (Cross-Section Width W)' : 'Cross-Section Width Line (W)'}
                            </span>
                            <span className="text-amber-400 font-mono font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/40">
                                {activePoint.widthM || 45} m
                            </span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="160"
                            step="2"
                            value={activePoint.widthM || 45}
                            onChange={(e) => onUpdateActivePoint({ widthM: Number(e.target.value) })}
                            className="w-full accent-amber-400 cursor-pointer"
                        />
                        <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                            <span>Min: 10m (Narrow Ridge)</span>
                            <span>Max: 160m (Wide Terrace Bed)</span>
                        </div>
                    </div>

                    {/* 3. SLOPE FALLOFF CURVE PROFILE */}
                    <div className="pt-2 border-t border-slate-800">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                            {isKa ? 'ფერდობის პროფილი (Falloff Curve)' : 'Slope Falloff Curve'}
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { id: 'cosine', label: '🌊 Rounded Mound' },
                                { id: 'linear', label: '📐 Linear Berm' },
                                { id: 'gaussian', label: '🔔 Bell Curve' },
                                { id: 'trapezoid', label: '🚜 Terrace Bed' }
                            ].map(f => (
                                <button
                                    key={`falloff-${f.id}`}
                                    type="button"
                                    onClick={() => onUpdateActivePoint({ slopeFalloff: f.id as any })}
                                    className={`py-1 px-2 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                                        activePoint.slopeFalloff === f.id
                                            ? 'bg-cyan-600 text-white border-cyan-400'
                                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SVG CROSS-SECTION PROFILE DIAGRAM */}
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {isKa ? 'განივი ჭრილის პირდაპირი სქემა' : 'Live Cross-Section Profile Diagram'}
                    </span>
                    <div className="w-full h-24 bg-slate-950 rounded-xl overflow-hidden p-2 flex items-center justify-center border border-slate-850">
                        <svg viewBox="0 0 300 90" className="w-full h-full">
                            {/* Grid lines */}
                            <line x1="0" y1="75" x2="300" y2="75" stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
                            <line x1="150" y1="10" x2="150" y2="85" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
                            
                            {/* Curve profile path based on height and width */}
                            {(() => {
                                const hNorm = Math.max(-30, Math.min(50, activePoint.peakHeightM));
                                const peakY = 75 - (hNorm * 1.1);
                                const halfW = Math.max(30, Math.min(130, (activePoint.widthM || 45) * 1.1));
                                const x1 = 150 - halfW;
                                const x2 = 150 + halfW;
                                
                                return (
                                    <>
                                        <path
                                            d={`M ${x1} 75 Q 150 ${peakY} ${x2} 75`}
                                            fill="none"
                                            stroke="#06b6d4"
                                            strokeWidth="3"
                                        />
                                        <path
                                            d={`M ${x1} 75 Q 150 ${peakY} ${x2} 75 Z`}
                                            fill="#06b6d4"
                                            fillOpacity="0.18"
                                        />
                                        {/* Width bar */}
                                        <line x1={x1} y1="80" x2={x2} y2="80" stroke="#f59e0b" strokeWidth="2" />
                                        <circle cx={x1} cy="80" r="3" fill="#f59e0b" />
                                        <circle cx={x2} cy="80" r="3" fill="#f59e0b" />
                                        <text x="150" y="88" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">
                                            Width: {activePoint.widthM || 45}m
                                        </text>
                                        {/* Height text */}
                                        <circle cx="150" cy={peakY} r="3.5" fill="#38bdf8" />
                                        <text x="150" y={Math.max(12, peakY - 4)} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                                            {activePoint.peakHeightM > 0 ? `+${activePoint.peakHeightM}m` : `${activePoint.peakHeightM}m`}
                                        </text>
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                </div>

                {/* AI AUTO-DETECT SLOPE & DEM INJECTION */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onAiAutoDetectSlope}
                        disabled={isAiSlopeScanning}
                        className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/60 cursor-pointer active:scale-95 transition-all"
                    >
                        <Sparkles size={13} className={isAiSlopeScanning ? 'animate-spin' : ''} />
                        <span>{isAiSlopeScanning ? 'Scanning...' : 'AI Auto-Detect Slope'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onLoadSatelliteDem}
                        className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Load InSAR Satellite DEM Radar Elevation"
                    >
                        <Satellite size={13} />
                        <span>DEM</span>
                    </button>
                </div>
            </div>
            )}
        </div>
    );
};
