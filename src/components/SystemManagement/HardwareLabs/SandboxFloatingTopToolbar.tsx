import React, { useState, useRef } from 'react';
import { 
    Camera, Navigation, User, Droplets, Mountain, 
    Layers, Eye, Sliders, Satellite, Map as MapIcon, 
    Save, Plus, GripHorizontal, Cpu, RotateCcw,
    RefreshCw, MapPin, Minimize2, Maximize2, ChevronUp, ChevronDown,
    Edit3, PenTool, Hexagon, Move, MousePointer, Trash2, Undo2,
    Video, Wifi, CloudRain, Radio
} from 'lucide-react';

interface SandboxFloatingTopToolbarProps {
    activeTool: string;
    onSelectTool: (tool: any) => void;
    isSlopeSculptorOpen: boolean;
    onToggleSlopeSculptor: () => void;
    is3dWindowOpen: boolean;
    onToggle3dWindow: () => void;
    isVisibilityMenuOpen: boolean;
    onToggleVisibilityMenu: () => void;
    hasSelectedObject: boolean;
    onToggleDevicePanel: () => void;
    tileMode: 'satellite' | 'streets' | '3d';
    onToggleTileMode: () => void;
    onOpenExportModal: () => void;
    onOpenHardwareList?: () => void;
    onFlyToPlantation?: () => void;
    onSwap2d3d?: () => void;
    onDeleteLastPoint?: () => void;
    canDeleteLastPoint?: boolean;
    onDeleteSlope?: () => void;
    hasSlope?: boolean;
    onClearMapFully?: () => void;
    onOpenLanScanner?: () => void;
    onOpenLiveStreamTool?: () => void;
    onOpenAllCamerasWide?: () => void;
    is3dMainView?: boolean;
    searchBar?: React.ReactNode;
    hiddenItemsCount: number;
    isKa?: boolean;
}

export const SandboxFloatingTopToolbar: React.FC<SandboxFloatingTopToolbarProps> = ({
    activeTool,
    onSelectTool,
    isSlopeSculptorOpen,
    onToggleSlopeSculptor,
    is3dWindowOpen,
    onToggle3dWindow,
    isVisibilityMenuOpen,
    onToggleVisibilityMenu,
    hasSelectedObject,
    onToggleDevicePanel,
    tileMode,
    onToggleTileMode,
    onOpenExportModal,
    onOpenHardwareList,
    onFlyToPlantation,
    onSwap2d3d,
    onDeleteLastPoint,
    canDeleteLastPoint = false,
    onDeleteSlope,
    hasSlope = false,
    onClearMapFully,
    onOpenLanScanner,
    onOpenLiveStreamTool,
    onOpenAllCamerasWide,
    is3dMainView = false,
    searchBar,
    hiddenItemsCount,
    isKa = false
}) => {
    // Movable / Draggable Position State
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
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
            startLeft: rect ? rect.left : (window.innerWidth / 2 - 250),
            startTop: rect ? rect.top : 64
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        e.preventDefault();
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newX = Math.max(8, Math.min(window.innerWidth - 120, dragRef.current.startLeft + dx));
        const newY = Math.max(8, Math.min(window.innerHeight - 80, dragRef.current.startTop + dy));
        setPos({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
        dragRef.current = null;
    };

    // Minimized View
    if (isMinimized) {
        return (
            <div
                ref={containerRef}
                style={pos ? {
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    transform: 'none'
                } : undefined}
                className={`z-[1100] flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-xs select-none ${
                    pos ? '' : 'absolute top-16 left-1/2 -translate-x-1/2'
                }`}
            >
                <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="px-2 py-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-cyan-400 flex items-center gap-1.5"
                    title="Drag anywhere"
                >
                    <GripHorizontal size={14} />
                    <span className="font-black text-cyan-300 uppercase tracking-wider text-[11px]">
                        🛠️ {isKa ? 'ხელსაწყოები (დაკეცილი)' : 'Tools (Minimized)'}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    title="Expand Toolbar"
                >
                    <ChevronDown size={13} />
                    <span>{isKa ? 'გაშლა' : 'Expand'}</span>
                </button>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={pos ? {
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'none'
            } : undefined}
            className={`z-[1100] max-w-[96vw] flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/94 border border-slate-700/80 shadow-2xl backdrop-blur-xl flex-wrap justify-center text-xs select-none ${
                pos ? '' : 'absolute top-16 left-1/2 -translate-x-1/2'
            }`}
        >
            {/* Movable Drag Grip Handle */}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={() => setPos(null)}
                className="px-1.5 py-2 cursor-grab active:cursor-grabbing text-slate-500 hover:text-cyan-400 flex items-center justify-center transition-colors rounded-lg hover:bg-slate-900/60"
                title={isKa ? 'გადაადგილება რუკაზე (ორჯერ დაწკაპუნება - საწყის ადგილზე დაბრუნება)' : 'Drag toolbar anywhere on map (double click to reset)'}
            >
                <GripHorizontal size={14} />
            </div>

            {/* Optional Integrated Search Bar */}
            {searchBar && (
                <div className="shrink-0 mr-0.5">
                    {searchBar}
                </div>
            )}

            {/* Device Placement Buttons */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onSelectTool(activeTool === 'add_camera' ? 'select' : 'add_camera')}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTool === 'add_camera'
                            ? 'bg-blue-600 text-white shadow ring-2 ring-blue-300'
                            : 'bg-blue-950/40 text-blue-300 border border-blue-800/50 hover:bg-blue-900/50'
                    }`}
                    title={isKa ? 'დააწკაპუნეთ რუკაზე ახალი კამერის დასამატებლად' : 'Click on map to add surveillance camera'}
                >
                    <Camera size={13} />
                    <span>+ {isKa ? 'კამერა' : 'Camera'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onSelectTool(activeTool === 'drone_waypoint' ? 'select' : 'drone_waypoint')}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTool === 'drone_waypoint'
                            ? 'bg-cyan-600 text-white shadow ring-2 ring-cyan-300'
                            : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 hover:bg-cyan-900/50'
                    }`}
                    title={isKa ? 'დააწკაპუნეთ რუკაზე დრონის მარშრუტის დასამატებლად' : 'Click on map to add drone flight waypoint'}
                >
                    <Navigation size={13} />
                    <span>+ {isKa ? 'დრონი' : 'Drone'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onSelectTool(activeTool === 'add_worker' ? 'select' : 'add_worker')}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTool === 'add_worker'
                            ? 'bg-purple-600 text-white shadow ring-2 ring-purple-300'
                            : 'bg-purple-950/40 text-purple-300 border border-purple-800/50 hover:bg-purple-900/50'
                    }`}
                    title={isKa ? 'დააწკაპუნეთ რუკაზე მუშის GPS ტრეკერის დასამატებლად' : 'Click on map to place worker GPS beacon'}
                >
                    <User size={13} />
                    <span>+ {isKa ? 'მუშა GPS' : 'Worker'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onSelectTool(activeTool === 'add_soil' ? 'select' : 'add_soil')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold hidden sm:flex items-center gap-1 transition-all cursor-pointer ${
                        activeTool === 'add_soil'
                            ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-300'
                            : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/50'
                    }`}
                    title={isKa ? 'დააწკაპუნეთ რუკაზე ნიადაგის NPK სენსორის დასამატებლად' : 'Click on map to place soil sensor'}
                >
                    <Droplets size={12} />
                    <span>+ {isKa ? 'ნიადაგი' : 'Soil'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onSelectTool(activeTool === 'add_weather' ? 'select' : 'add_weather')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold hidden md:flex items-center gap-1 transition-all cursor-pointer ${
                        activeTool === 'add_weather'
                            ? 'bg-orange-600 text-white shadow ring-2 ring-orange-300'
                            : 'bg-orange-950/40 text-orange-300 border border-orange-800/50 hover:bg-orange-900/50'
                    }`}
                    title={isKa ? 'დააწკაპუნეთ რუკაზე მეტეო სადგურის დასასმელად' : 'Click on map to place weather station'}
                >
                    <CloudRain size={12} />
                    <span>+ {isKa ? 'მეტეო' : 'Weather'}</span>
                </button>
            </div>

            <div className="w-[1px] h-6 bg-slate-800 mx-0.5" />

            {/* Select / Move Tool */}
            <button
                type="button"
                onClick={() => onSelectTool('select')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTool === 'select'
                        ? 'bg-slate-700 text-cyan-300 shadow ring-2 ring-cyan-400'
                        : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                }`}
                title={isKa ? 'წერტილების და ხაზების გადაადგილება / არჩევა' : 'Select & Move points, lines, devices freely'}
            >
                <Move size={13} />
                <span>{isKa ? 'გადაადგილება' : 'Move / Select'}</span>
            </button>

            {/* Direct Live Stream Tool */}
            <button
                type="button"
                onClick={() => {
                    onSelectTool(activeTool === 'live_stream' ? 'select' : 'live_stream');
                    if (onOpenLiveStreamTool) onOpenLiveStreamTool();
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTool === 'live_stream'
                        ? 'bg-rose-600 text-white font-black shadow-lg ring-2 ring-rose-300 animate-pulse'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-600/50 hover:bg-rose-900/50'
                }`}
                title={isKa ? 'პირდაპირი ვიდეო ნაკადის ნახვა (RTSP/WebRTC) რუკიდან' : 'Live Stream View (RTSP/WebRTC) directly from map'}
            >
                <Video size={13} className="stroke-[2.5]" />
                <span>📹 {isKa ? 'ლაივ სტრიმი' : 'Live Stream'}</span>
            </button>

            {/* Direct Click-to-Draw Slope Ridge Tool */}
            <button
                type="button"
                onClick={() => onSelectTool(activeTool === 'draw_slope' ? 'select' : 'draw_slope')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTool === 'draw_slope'
                        ? 'bg-amber-500 text-slate-950 font-black shadow ring-2 ring-amber-300 animate-pulse'
                        : 'bg-amber-950/40 text-amber-300 border border-amber-600/50 hover:bg-amber-900/50'
                }`}
                title={isKa ? 'დააწკაპუნეთ რუკაზე ქედის წერტილების (A, B, C...) თანმიმდევრობით დასასმელად' : 'Click on map to place ridge points (A, B, C, D...)'}
            >
                <Edit3 size={13} className="stroke-[2.5]" />
                <span>✏️ {isKa ? 'ქედის დახატვა' : 'Draw Slope'}</span>
            </button>

            {/* Draw Custom Organic Perimeter Boundary Polygon */}
            <button
                type="button"
                onClick={() => onSelectTool(activeTool === 'draw_perimeter' ? 'select' : 'draw_perimeter')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTool === 'draw_perimeter'
                        ? 'bg-fuchsia-600 text-white font-black shadow ring-2 ring-fuchsia-300 animate-pulse'
                        : 'bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-600/50 hover:bg-fuchsia-900/50'
                }`}
                title={isKa ? 'პერიმეტრის დახატვა წერტილ-წერტილ და 3D რელიეფად გარდაქმნა' : 'Draw perimeter boundary with draggable point lines & loft to 3D'}
            >
                <Hexagon size={13} className="stroke-[2.5]" />
                <span>📐 {isKa ? 'პერიმეტრი' : 'Draw Perimeter'}</span>
            </button>

            {/* Back Button (Delete Last Edited Point via Back Button or Backspace) */}
            {onDeleteLastPoint && (
                <button
                    type="button"
                    onClick={onDeleteLastPoint}
                    disabled={!canDeleteLastPoint}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        canDeleteLastPoint
                            ? 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-600/60 shadow-sm active:scale-95'
                            : 'opacity-40 bg-slate-900/40 text-slate-500 border border-slate-800 cursor-not-allowed'
                    }`}
                    title={isKa ? 'ბოლო რედაქტირებული წერტილის წაშლა (Backspace / ⌫ ან Back ღილაკი)' : 'Delete last edited point (Backspace / ⌫ or Back button)'}
                >
                    <Undo2 size={13} className="text-rose-400 stroke-[2.5]" />
                    <span>{isKa ? 'უკან წაშლა' : 'Back'}</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-rose-900/80 text-rose-200 font-mono font-bold border border-rose-700/50">⌫</span>
                </button>
            )}

            {/* 3D Mound & Slope Sculptor Toggle (Right Floating Panel) */}
            <button
                type="button"
                onClick={onToggleSlopeSculptor}
                className={`px-3.5 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSlopeSculptorOpen
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg ring-2 ring-amber-300'
                        : 'bg-amber-950/50 text-amber-300 border border-amber-500/40 hover:bg-amber-900/50'
                }`}
                title={isKa ? '3D რელიეფის, ქედის და განივი ხაზების პანელი (მარჯვნიდან)' : '3D Mound & Slope sculptor tool (floats from right)'}
            >
                <Mountain size={13} className="stroke-[2.5]" />
                <span>🏔️ {isKa ? '3D რელიეფი & ქედი' : '3D Mound / Slope'}</span>
            </button>

            {/* Delete Whole Slope Button */}
            {onDeleteSlope && (
                <button
                    type="button"
                    onClick={onDeleteSlope}
                    disabled={!hasSlope}
                    className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        hasSlope
                            ? 'bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/60 active:scale-95 shadow-sm'
                            : 'opacity-40 bg-slate-900/40 text-slate-500 border border-slate-800 cursor-not-allowed'
                    }`}
                    title={isKa ? 'მთელი 3D რელიეფის და ქედის წაშლა' : 'Delete whole slope & ridge profile'}
                >
                    <Trash2 size={13} className="text-red-400" />
                    <span>{isKa ? 'რელიეფის წაშლა' : 'Delete Slope'}</span>
                </button>
            )}

            {/* 3D View Window Toggle */}
            <button
                type="button"
                onClick={onToggle3dWindow}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    is3dWindowOpen
                        ? 'bg-cyan-600 text-white shadow ring-2 ring-cyan-300'
                        : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 hover:bg-cyan-900/50'
                }`}
                title={isKa ? '3D ხედის ფანჯარა' : 'Floating 3D PiP Viewport Window'}
            >
                <Layers size={13} />
                <span>🧊 {isKa ? '3D ხედი' : '3D View'}</span>
            </button>

            {/* 2D / 3D Fullscreen Swap Button */}
            {onSwap2d3d && (
                <button
                    type="button"
                    onClick={onSwap2d3d}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        is3dMainView
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg ring-2 ring-cyan-300'
                            : 'bg-slate-900 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-950/60'
                    }`}
                    title={isKa ? '2D და 3D ხედების გაცვლა (3D სრული ეკრანით გაშვება)' : 'Swap 2D and 3D views (run 3D in full screen)'}
                >
                    <RefreshCw size={12} className={is3dMainView ? 'animate-spin' : ''} />
                    <span>{is3dMainView ? '🗺️ 2D Main' : '🧊 3D Main'}</span>
                </button>
            )}

            {/* Fly to Plantation Location */}
            {onFlyToPlantation && (
                <button
                    type="button"
                    onClick={onFlyToPlantation}
                    className="px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/60 transition-all cursor-pointer"
                    title={isKa ? 'პლანტაციის ლოკაციაზე გადაფრენა' : 'Always open / fly to plantation location'}
                >
                    <MapPin size={13} className="text-emerald-400" />
                    <span>{isKa ? 'პლანტაცია' : 'Plantation'}</span>
                </button>
            )}

            <div className="w-[1px] h-6 bg-slate-800 mx-0.5" />

            {/* Layers & Visibility Filter Popover Toggle */}
            <button
                type="button"
                onClick={onToggleVisibilityMenu}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isVisibilityMenuOpen
                        ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-300'
                        : 'bg-slate-900 text-slate-300 border border-slate-700/80 hover:text-white'
                }`}
                title={isKa ? 'ყველა ან ცალკეული ელემენტის დამალვა/გამოჩენა' : 'Hide all items or some items from the map'}
            >
                <Eye size={13} />
                <span>{isKa ? 'ხილვადობა' : 'Visibility'}</span>
                {hiddenItemsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40">
                        {hiddenItemsCount}
                    </span>
                )}
            </button>

            {/* Device Configuration Panel Toggle (Left Floating Panel) */}
            <button
                type="button"
                onClick={onToggleDevicePanel}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    hasSelectedObject
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-900 text-slate-300 border border-slate-700/80 hover:text-white'
                }`}
                title={isKa ? 'მოწყობილობების მართვის პანელი (მარცხნიდან)' : 'Device configuration panel (floats from left)'}
            >
                <Sliders size={13} />
                <span>{hasSelectedObject ? (isKa ? 'პანელის დახურვა' : 'Close Panel') : (isKa ? 'მოწყობილობები' : 'Device Panel')}</span>
            </button>

            {/* Hardware Devices List Link Button */}
            {onOpenHardwareList && (
                <button
                    type="button"
                    onClick={onOpenHardwareList}
                    className="px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-700/70 transition-all cursor-pointer shadow-sm active:scale-95"
                    title={isKa ? 'მოწყობილობების სრული სია & დაბალი დონის დრაივერები' : 'Open full Hardware & Devices List with all driver management tools'}
                >
                    <Cpu size={13} className="text-blue-400" />
                    <span>{isKa ? '🔌 მოწყობილობები' : '🔌 Devices'}</span>
                </button>
            )}

            {/* Scan LAN & NVR Hardware Button */}
            {onOpenLanScanner && (
                <button
                    type="button"
                    onClick={onOpenLanScanner}
                    className="px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-900/40 transition-all cursor-pointer active:scale-95"
                    title={isKa ? 'ლოკალური ქსელის (LAN) სკანირება: NVR, კამერები, დრონები, GPS, სენსორები, მეტეო' : 'Scan LAN for NVRs, Cameras, Drones, GPS, Soil Sensors & Weather Stations'}
                >
                    <Wifi size={13} />
                    <span>📡 {isKa ? 'LAN სკანერი' : 'Scan LAN'}</span>
                </button>
            )}

            {/* All Cameras Wide Matrix View */}
            {onOpenAllCamerasWide && (
                <button
                    type="button"
                    onClick={onOpenAllCamerasWide}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                    title={isKa ? 'ვიდეოთვალთვალის სრული მატრიცის გახსნა (ყველა კამერის ერთდროული ნახვა)' : 'Open Wide Matrix for all surveillance cameras'}
                >
                    <Video size={12} className="text-cyan-400" />
                    <span>📺 {isKa ? 'მატრიცა' : 'Matrix'}</span>
                </button>
            )}

            {/* Tile Layer Mode Switcher */}
            <button
                type="button"
                onClick={onToggleTileMode}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl font-bold text-[11px] cursor-pointer"
                title="Toggle Satellite / Streets Map"
            >
                {tileMode === 'satellite' ? '🛰️ Sat' : '🗺️ Street'}
            </button>

            {/* Export as Layer to Map Planner */}
            <button
                type="button"
                onClick={onOpenExportModal}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center gap-1 shadow cursor-pointer active:scale-95 transition-all"
                title={isKa ? 'მთავარ რუკაზე ექსპორტი ახალ ფენად' : 'Export tested hardware to Map Planner'}
            >
                <Save size={12} />
                <span>{isKa ? 'ექსპორტი' : 'Export'}</span>
            </button>

            {/* Clear Map Fully Button */}
            {onClearMapFully && (
                <button
                    type="button"
                    onClick={onClearMapFully}
                    className="px-2.5 py-1.5 bg-red-950/70 hover:bg-red-900/90 text-red-200 border border-red-700/70 rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center gap-1 shadow cursor-pointer active:scale-95 transition-all"
                    title={isKa ? 'რუკის სრულად გასუფთავება (ყველა მოწყობილობა, რელიეფი, მარშრუტები)' : 'Clear map fully (remove all devices, slope, waypoints)'}
                >
                    <Trash2 size={12} className="text-red-300" />
                    <span>🧹 {isKa ? 'გასუფთავება' : 'Clear Map'}</span>
                </button>
            )}

            {/* Minimize Toolbar Button */}
            <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 cursor-pointer transition-colors"
                title="Minimize toolbar"
            >
                <ChevronUp size={13} />
            </button>

            {pos && (
                <button
                    type="button"
                    onClick={() => setPos(null)}
                    className="p-1.5 text-slate-500 hover:text-slate-200 cursor-pointer"
                    title="Reset position to top center"
                >
                    <RotateCcw size={11} />
                </button>
            )}
        </div>
    );
};
