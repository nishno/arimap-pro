import React, { useEffect, useRef, useState } from 'react';
import { 
    X, Leaf, Building2, Square, Rows3, Droplets, MapPin, 
    Compass, PlusCircle, Briefcase, Calendar, FileText, 
    Send, Bot, Copy, Check, ExternalLink, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export interface MapCanvasContextMenuProps {
    position: { x: number; y: number };
    coordinates?: { lat: number; lng: number };
    onClose: () => void;
    onOpenCropModal: () => void;
    onOpenCompanyRegistration: () => void;
    onSelectDrawingTool?: (tool: string) => void;
    onOpenMapPlanner?: () => void;
    onAddWork?: (coords: { lat: number; lng: number }) => void;
    onAddTask?: (coords: { lat: number; lng: number }) => void;
    onAddNote?: (coords: { lat: number; lng: number }) => void;
    onOpenDroneSimulation?: (coords?: { lat: number; lng: number }) => void;
    onOpenAiAnalysis?: (coords?: { lat: number; lng: number }) => void;
    activeOrgName?: string;
}

export const MapCanvasContextMenu: React.FC<MapCanvasContextMenuProps> = ({
    position,
    coordinates,
    onClose,
    onOpenCropModal,
    onOpenCompanyRegistration,
    onSelectDrawingTool,
    onOpenMapPlanner,
    onAddWork,
    onAddTask,
    onAddNote,
    onOpenDroneSimulation,
    onOpenAiAnalysis,
    activeOrgName
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const menuRef = useRef<HTMLDivElement>(null);
    const [copiedCoords, setCopiedCoords] = useState(false);

    // Auto-clamp position inside viewport
    const [clampedPos, setClampedPos] = useState({ x: position.x, y: position.y });

    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const menuWidth = rect.width || 310;
        const menuHeight = rect.height || 480;

        const maxX = window.innerWidth - menuWidth - 16;
        const maxY = window.innerHeight - menuHeight - 16;

        setClampedPos({
            x: Math.max(12, Math.min(maxX, position.x)),
            y: Math.max(12, Math.min(maxY, position.y))
        });
    }, [position]);

    // Close on escape key or click outside
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const handlePointerDown = (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('pointerdown', handlePointerDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [onClose]);

    const formattedCoords = coordinates 
        ? `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
        : null;

    const handleCopyCoordinates = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!formattedCoords) return;
        navigator.clipboard.writeText(formattedCoords);
        setCopiedCoords(true);
        toast.success(isKa ? `კოორდინატები კოპირებულია: ${formattedCoords}` : `Coordinates copied: ${formattedCoords}`);
        setTimeout(() => setCopiedCoords(false), 2000);
    };

    return (
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                left: `${clampedPos.x}px`,
                top: `${clampedPos.y}px`,
                zIndex: 9999
            }}
            className="w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-2.5 text-white text-xs select-none animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Header with GPS Coordinates & Org Name */}
            <div className="px-3 py-2 border-b border-slate-800/80 mb-2 flex items-start justify-between">
                <div className="min-w-0 pr-2">
                    <div className="font-black text-slate-100 truncate text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isKa ? 'რუკის კონტექსტური მენიუ' : 'Map Context Menu'}</span>
                    </div>

                    {formattedCoords && (
                        <div 
                            onClick={handleCopyCoordinates}
                            className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] cursor-pointer hover:bg-emerald-500/20 transition-colors w-fit"
                            title={isKa ? "დააჭირეთ კოპირებისთვის" : "Click to copy GPS"}
                        >
                            <span>📍 {formattedCoords}</span>
                            {copiedCoords ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} className="text-slate-400" />}
                        </div>
                    )}

                    {activeOrgName && (
                        <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            🏢 {activeOrgName}
                        </p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title={isKa ? "დახურვა" : "Close"}
                >
                    <X size={14} />
                </button>
            </div>

            {/* SECTION 1: WORK, TASK & NOTE AT LOCATION */}
            <div className="space-y-1">
                <div className="px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
                    <Briefcase size={10} />
                    <span>{isKa ? "სამუშაო & დავალებები ამ ადგილზე" : "Work & Task on This Spot"}</span>
                </div>

                {/* 1. Add Work Assignment */}
                <button
                    id="ctx-map-add-work"
                    onClick={() => {
                        if (onAddWork && coordinates) onAddWork(coordinates);
                        else {
                            window.dispatchEvent(new CustomEvent('agrimap_open_work_modal', { detail: { coordinates, mode: 'work' } }));
                        }
                        onClose();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-amber-400 hover:text-slate-950 hover:bg-amber-400 transition-all cursor-pointer group"
                >
                    <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-slate-950 group-hover:text-amber-400 transition-all flex-shrink-0">
                        <Briefcase size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-wide truncate">
                            {isKa ? "სამუშაოს დამატება ამ ადგილზე" : "Add Work Assignment Here"}
                        </div>
                        <div className="text-[9px] text-slate-400 group-hover:text-slate-900/80 truncate">
                            {isKa ? "მორწყვა, შეწამვლა, მოსავლის აღება → სამუშაოების მოდული" : "Watering, spraying, harvest → Tasks & Works module"}
                        </div>
                    </div>
                </button>

                {/* 2. Add Planner Task & Reminder */}
                <button
                    id="ctx-map-add-task"
                    onClick={() => {
                        if (onAddTask && coordinates) onAddTask(coordinates);
                        else {
                            window.dispatchEvent(new CustomEvent('agrimap_open_work_modal', { detail: { coordinates, mode: 'task' } }));
                        }
                        onClose();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-blue-400 hover:text-white hover:bg-blue-600/30 transition-all cursor-pointer group"
                >
                    <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all flex-shrink-0">
                        <Calendar size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-wide truncate">
                            {isKa ? "დავალება / შეხსენება დამგეგმავში" : "Add Task to Planner & Reminders"}
                        </div>
                        <div className="text-[9px] text-slate-400 group-hover:text-blue-200 truncate">
                            {isKa ? "ვადა, პრიორიტეტი, კალენდარი და შეხსენებები" : "Due date, priority, calendar & alert sync"}
                        </div>
                    </div>
                </button>

                {/* 3. Add Field Note */}
                <button
                    id="ctx-map-add-note"
                    onClick={() => {
                        if (onAddNote && coordinates) onAddNote(coordinates);
                        else {
                            window.dispatchEvent(new CustomEvent('agrimap_open_work_modal', { detail: { coordinates, mode: 'note' } }));
                        }
                        onClose();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-emerald-400 hover:text-white hover:bg-emerald-600/30 transition-all cursor-pointer group"
                >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all flex-shrink-0">
                        <FileText size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-wide truncate">
                            {isKa ? "საველე შენიშვნის დასმა ამ წერტილზე" : "Pin Field Note on This Spot"}
                        </div>
                        <div className="text-[9px] text-slate-400 group-hover:text-emerald-200 truncate">
                            {isKa ? "ჩანიშვნა და სინქრონიზაცია შენიშვნების მოდულთან" : "Pinned field observation & synced with notes ledger"}
                        </div>
                    </div>
                </button>
            </div>

            {/* SECTION 2: DRONE & AI TOOLS */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                <div className="px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>{isKa ? "დრონი და AI ხელსაწყოები" : "Drone & AI Autonomous Tools"}</span>
                </div>

                {/* Launch Drone Simulation */}
                <button
                    id="ctx-map-drone-mission"
                    onClick={() => {
                        if (onOpenDroneSimulation) onOpenDroneSimulation(coordinates);
                        else {
                            window.dispatchEvent(new CustomEvent('agrimap_open_drone_simulation', { detail: { coordinates } }));
                        }
                        onClose();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 text-left font-bold text-indigo-300 hover:text-white hover:bg-indigo-600/30 transition-all cursor-pointer group"
                >
                    <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all flex-shrink-0">
                        <Send size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10.5px] font-black truncate">
                            {isKa ? "დრონის ფრენის დაწყება ამ ადგილიდან" : "Launch Drone Flight From Here"}
                        </div>
                        <div className="text-[8.5px] text-slate-400 group-hover:text-indigo-200 truncate">
                            {isKa ? "UAV ავტონომიური აეროგადაღება და მარშრუტი" : "UAV aerial survey & mission corridor"}
                        </div>
                    </div>
                </button>

                {/* AI Agronomy & Vision Advisory */}
                <button
                    id="ctx-map-ai-advisory"
                    onClick={() => {
                        if (onOpenAiAnalysis) onOpenAiAnalysis(coordinates);
                        else {
                            window.dispatchEvent(new CustomEvent('agrimap_open_ai_advisory', { detail: { coordinates } }));
                        }
                        onClose();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 text-left font-bold text-violet-300 hover:text-white hover:bg-violet-600/30 transition-all cursor-pointer group"
                >
                    <div className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-violet-500 group-hover:text-white transition-all flex-shrink-0">
                        <Bot size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10.5px] font-black truncate">
                            {isKa ? "AI აგრო ანალიზი ამ კოორდინატზე" : "AI Agronomy Analysis at GPS"}
                        </div>
                        <div className="text-[8.5px] text-slate-400 group-hover:text-violet-200 truncate">
                            {isKa ? "ნიადაგის, კულტურისა და ანომალიების ანალიზი" : "Crop health, soil insights & anomaly checks"}
                        </div>
                    </div>
                </button>
            </div>

            {/* SECTION 3: OPEN IN MAP PLANNER */}
            <div className="mt-2 pt-2 border-t border-slate-800/80">
                <button
                    id="ctx-map-open-planner"
                    onClick={() => {
                        if (onOpenMapPlanner) onOpenMapPlanner();
                        else {
                            window.dispatchEvent(new CustomEvent('agrimap_open_map_planner'));
                        }
                        onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white hover:from-emerald-600 hover:to-teal-600 transition-all cursor-pointer group shadow-sm"
                >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-white group-hover:text-emerald-700 transition-all flex-shrink-0">
                        <Compass size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5">
                            <span>{isKa ? "გახსნა რუკის დამგეგმავში" : "Open in Map Planner"}</span>
                            <ExternalLink size={11} />
                        </div>
                        <div className="text-[8.5px] text-emerald-200/80 group-hover:text-white truncate">
                            {isKa ? "მიწის მოძიება, რეგისტრაცია და საზღვრების მართვა" : "Find land, register parcels & manage plantation"}
                        </div>
                    </div>
                </button>
            </div>

            {/* SECTION 4: DRAWING TOOLS */}
            {onSelectDrawingTool && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                    <div className="px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-slate-500">
                        {isKa ? "მოხაზვის ხელსაწყოები" : "Drawing Tools"}
                    </div>

                    <button
                        onClick={() => {
                            onSelectDrawingTool('sector');
                            onClose();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer text-[10px]"
                    >
                        <Square size={13} className="text-emerald-400" />
                        <span>{isKa ? "სექტორის / ზონის მოხაზვა" : "Draw Sector Area"}</span>
                    </button>

                    <button
                        onClick={() => {
                            onSelectDrawingTool('trench');
                            onClose();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer text-[10px]"
                    >
                        <Rows3 size={13} className="text-orange-400" />
                        <span>{isKa ? "თხრილის / მწკრივის გაყვანა" : "Draw Trench Row"}</span>
                    </button>

                    <button
                        onClick={() => {
                            onSelectDrawingTool('irrigation');
                            onClose();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer text-[10px]"
                    >
                        <Droplets size={13} className="text-cyan-400" />
                        <span>{isKa ? "სარწყავი სისტემის დახაზვა" : "Draw Irrigation Line"}</span>
                    </button>
                </div>
            )}

            {/* SECTION 5: CROPS & ENTERPRISE */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5">
                <button
                    id="ctx-map-crops"
                    onClick={() => {
                        onOpenCropModal();
                        onClose();
                    }}
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-emerald-600/30 border border-slate-700/50 hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
                >
                    <Leaf size={14} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                    <div className="text-[10px] font-black text-slate-200 group-hover:text-white truncate">
                        {isKa ? "კულტურები" : "Crops Catalog"}
                    </div>
                </button>

                <button
                    id="ctx-map-company-reg"
                    onClick={() => {
                        onOpenCompanyRegistration();
                        onClose();
                    }}
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-blue-600/30 border border-slate-700/50 hover:border-blue-500/50 text-left transition-all cursor-pointer group"
                >
                    <Building2 size={14} className="text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
                    <div className="text-[10px] font-black text-slate-200 group-hover:text-white truncate">
                        {isKa ? "კომპანია" : "Company Hub"}
                    </div>
                </button>
            </div>
        </div>
    );
};

export default MapCanvasContextMenu;
