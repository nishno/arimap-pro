import React, { useEffect, useRef, useState } from 'react';
import { 
    Move, RefreshCw, Trash2, Car, Tractor, 
    Droplets, Square, X, ChevronRight, Compass,
    FileText, MapPin, Plane, Sparkles, Leaf, Building2
} from 'lucide-react';
import type { PlantationFeature, LinePlantationFeature } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

export interface MapFeatureContextMenuProps {
    feature: PlantationFeature;
    position: { x: number; y: number };
    onClose: () => void;
    onMove: (feature: PlantationFeature) => void;
    onConvert: (feature: PlantationFeature, targetType: 'road' | 'trench' | 'irrigation' | 'area' | 'boundary' | 'note' | 'checkpoint' | 'drone_direction') => void;
    onDelete: (feature: PlantationFeature) => void;
    onOpenPencilOptions?: (feature: PlantationFeature) => void;
    onOpenCropModal?: () => void;
    onOpenCompanyRegistration?: () => void;
}

export const MapFeatureContextMenu: React.FC<MapFeatureContextMenuProps> = ({
    feature,
    position,
    onClose,
    onMove,
    onConvert,
    onDelete,
    onOpenPencilOptions,
    onOpenCropModal,
    onOpenCompanyRegistration
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const menuRef = useRef<HTMLDivElement>(null);
    const [showConvertSubmenu, setShowConvertSubmenu] = useState(false);

    // Auto clamp inside viewport so context menu doesn't overflow screen bounds
    const [clampedPos, setClampedPos] = useState({ x: position.x, y: position.y });

    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const menuWidth = rect.width || 250;
        const menuHeight = rect.height || 320;

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

    const isLine = feature.type === 'line' || feature.type === 'trench' || feature.type === 'irrigation_line' || (feature as any).type === 'pencil';
    const isPencil = (feature as any).isPencil || (feature as any).subType === 'pencil' || (feature as any).type === 'pencil';
    const lineType = (feature as LinePlantationFeature).lineType;
    const isRoad = lineType === 'road' || lineType === 'path';
    const isTrench = feature.type === 'trench' || lineType === 'row';
    const isIrrigation = feature.type === 'irrigation_line' || lineType === 'irrigation';
    const isArea = feature.type === 'area' || feature.type === 'sector' || feature.type === 'boundary';
    const isDroneDirection = (feature as any).subType === 'drone_direction';

    const getBadgeLabel = () => {
        if (isPencil) return isKa ? 'ფანქრის ნახაზი' : 'Pencil Drawing';
        if (isDroneDirection) return isKa ? 'დრონის მარშრუტი' : 'Drone Flight Path';
        if (isRoad) return isKa ? 'გზა ტრანსპორტისთვის' : 'Vehicle Road';
        if (isTrench) return isKa ? 'თხრილის რიგი' : 'Trench Row';
        if (isIrrigation) return isKa ? 'სარწყავი მილი' : 'Irrigation Pipe';
        if (feature.type === 'boundary') return isKa ? 'გარე საზღვარი' : 'Outer Boundary';
        if (feature.type === 'sector' || feature.type === 'area') return isKa ? 'საველე სექტორი' : 'Field Sector';
        if (feature.type === 'seedling') return isKa ? 'ნერგი' : 'Seedling Plant';
        if (feature.type === 'note') return isKa ? 'საველე ჩანაწერი' : 'Field Note';
        return isKa ? 'რუკის ობიექტი' : 'Map Feature';
    };

    const getBadgeColor = () => {
        if (isPencil) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        if (isDroneDirection) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
        if (isRoad) return 'bg-stone-500/20 text-stone-300 border-stone-500/30';
        if (isTrench) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        if (isIrrigation) return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
        if (feature.type === 'boundary') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
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
            className="w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-2 text-white text-xs select-none animate-in fade-in zoom-in-95 duration-150"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Header with Title and Type Badge */}
            <div className="px-3 py-2 border-b border-slate-800/80 mb-1.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                    <p className="font-black text-slate-100 truncate text-[11px] uppercase tracking-wide">
                        {feature.name || (isKa ? 'მონიშნული ობიექტი' : 'Selected Item')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${getBadgeColor()}`}>
                            {getBadgeLabel()}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title={isKa ? "დახურვა" : "Close"}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-1">
                {/* Optional: Pencil Options & Conversion Modal trigger if pencil */}
                {isPencil && onOpenPencilOptions && (
                    <button
                        id="ctx-btn-pencil-modal"
                        onClick={() => {
                            onOpenPencilOptions(feature);
                            onClose();
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 transition-all cursor-pointer group"
                    >
                        <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                            <Sparkles size={13} />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-wide">
                                {isKa ? "ფანქრის პარამეტრები..." : "Pencil Options..."}
                            </div>
                            <div className="text-[9px] text-amber-300/80 font-normal">
                                {isKa ? "კონვერტაციის დიალოგი & დეტალები" : "Conversion dialog & details"}
                            </div>
                        </div>
                    </button>
                )}

                {/* 1. MOVE OPTION */}
                <button
                    id="ctx-btn-move"
                    onClick={() => {
                        onMove(feature);
                        onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-slate-200 hover:text-white hover:bg-slate-800/90 transition-all cursor-pointer group"
                >
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Move size={13} />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wide">
                            {isKa ? "გადაადგილება / გეომეტრიის ჩასწორება" : "Move / Edit Geometry"}
                        </div>
                        <div className="text-[9px] text-slate-400 font-normal">
                            {isKa ? "წერტილების პოზიციის შეცვლა რუკაზე" : "Reposition vertices on map"}
                        </div>
                    </div>
                </button>

                {/* 2. CONVERT OPTION */}
                <div className="relative">
                    <button
                        id="ctx-btn-convert"
                        onClick={() => setShowConvertSubmenu(!showConvertSubmenu)}
                        onMouseEnter={() => setShowConvertSubmenu(true)}
                        className={`w-full px-3 py-2 rounded-xl flex items-center justify-between font-bold transition-all cursor-pointer group ${
                            showConvertSubmenu ? 'bg-slate-800 text-white' : 'text-slate-200 hover:text-white hover:bg-slate-800/90'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                <RefreshCw size={13} />
                            </div>
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-wide">
                                    {isKa ? "ობიექტის კონვერტაცია" : "Convert Asset"}
                                </div>
                                <div className="text-[9px] text-slate-400 font-normal">
                                    {isKa ? "ხაზის / ფართობის ტიპის შეცვლა" : "Change line/area/type"}
                                </div>
                            </div>
                        </div>
                        <ChevronRight size={14} className={`text-slate-500 transition-transform ${showConvertSubmenu ? 'rotate-90 text-emerald-400' : ''}`} />
                    </button>

                    {/* Submenu of Conversion Targets */}
                    {showConvertSubmenu && (
                        <div 
                            className="mt-1 ml-2 p-1.5 bg-slate-950/95 border border-slate-700/80 rounded-xl space-y-0.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-100"
                            onMouseLeave={() => setShowConvertSubmenu(false)}
                        >
                            {/* Convert to Note */}
                            <button
                                id="ctx-convert-note"
                                onClick={() => {
                                    onConvert(feature, 'note');
                                    onClose();
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                            >
                                <FileText size={13} className="text-blue-400" />
                                <span>{isKa ? "ჩანაწერად გადაკეთება" : "Convert to Field Note"}</span>
                            </button>

                            {/* Convert to Checkpoint */}
                            <button
                                id="ctx-convert-checkpoint"
                                onClick={() => {
                                    onConvert(feature, 'checkpoint');
                                    onClose();
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                            >
                                <MapPin size={13} className="text-purple-400" />
                                <span>{isKa ? "საკონტროლო პუნქტად გადაკეთება" : "Convert to Checkpoint"}</span>
                            </button>

                            {/* Convert to Direction for Drones */}
                            <button
                                id="ctx-convert-drone-direction"
                                onClick={() => {
                                    onConvert(feature, 'drone_direction');
                                    onClose();
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                            >
                                <Plane size={13} className="text-cyan-400" />
                                <span>{isKa ? "დრონის მიმართულებად გადაკეთება" : "Convert to Drone Direction"}</span>
                            </button>

                            {/* Convert to Road */}
                            {!isRoad && (isTrench || isLine || isPencil) && (
                                <button
                                    id="ctx-convert-road"
                                    onClick={() => {
                                        onConvert(feature, 'road');
                                        onClose();
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                                >
                                    <Car size={13} className="text-stone-400" />
                                    <span>{isKa ? "გზად გადაკეთება" : "Convert to Vehicle Road"}</span>
                                </button>
                            )}

                            {/* Convert to Trench Row */}
                            {!isTrench && (isRoad || isLine || isPencil) && (
                                <button
                                    id="ctx-convert-trench"
                                    onClick={() => {
                                        onConvert(feature, 'trench');
                                        onClose();
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                                >
                                    <Tractor size={13} className="text-orange-400" />
                                    <span>{isKa ? "თხრილის რიგად გადაკეთება" : "Convert to Trench Row"}</span>
                                </button>
                            )}

                            {/* Convert to Irrigation Line */}
                            {!isIrrigation && (isLine || isPencil) && (
                                <button
                                    id="ctx-convert-irrigation"
                                    onClick={() => {
                                        onConvert(feature, 'irrigation');
                                        onClose();
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                                >
                                    <Droplets size={13} className="text-sky-400" />
                                    <span>{isKa ? "სარწყავ მილად გადაკეთება" : "Convert to Irrigation Pipe"}</span>
                                </button>
                            )}

                            {/* Convert Pencil / Line to Sector Area */}
                            {(isPencil || (isLine && !isArea)) && (
                                <button
                                    id="ctx-convert-sector"
                                    onClick={() => {
                                        onConvert(feature, 'area');
                                        onClose();
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                                >
                                    <Square size={13} className="text-emerald-400" />
                                    <span>{isKa ? "სექტორად / ზონად გადაკეთება" : "Convert to Field Sector"}</span>
                                </button>
                            )}

                            {/* Convert Area to Outer Boundary */}
                            {isArea && feature.type !== 'boundary' && (
                                <button
                                    id="ctx-convert-boundary"
                                    onClick={() => {
                                        onConvert(feature, 'boundary');
                                        onClose();
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all text-[10px]"
                                >
                                    <Compass size={13} className="text-blue-400" />
                                    <span>{isKa ? "გარე საზღვრად გადაკეთება" : "Convert to Outer Boundary"}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-px bg-slate-800 my-1" />

                {/* Crop Management Option */}
                {onOpenCropModal && (
                    <button
                        id="ctx-btn-crops"
                        onClick={() => {
                            onOpenCropModal();
                            onClose();
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-emerald-400 hover:text-white hover:bg-emerald-600/30 transition-all cursor-pointer group"
                    >
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                            <Leaf size={13} />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-wide">
                                {isKa ? "კულტურების მართვა" : "Crop Management"}
                            </div>
                            <div className="text-[9px] text-emerald-300/80 font-normal">
                                {isKa ? "პლანტაციის კულტურები და ჯიშები" : "Plantation crops & varieties"}
                            </div>
                        </div>
                    </button>
                )}

                {/* Company Registration Option */}
                {onOpenCompanyRegistration && (
                    <button
                        id="ctx-btn-company-reg"
                        onClick={() => {
                            onOpenCompanyRegistration();
                            onClose();
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-blue-400 hover:text-white hover:bg-blue-600/30 transition-all cursor-pointer group"
                    >
                        <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Building2 size={13} />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-wide">
                                {isKa ? "კომპანიის რეგისტრაცია" : "Company Registration"}
                            </div>
                            <div className="text-[9px] text-blue-300/80 font-normal">
                                {isKa ? "საწარმოს პროფილი და რეგისტრაცია" : "Enterprise profile & registration"}
                            </div>
                        </div>
                    </button>
                )}

                <div className="h-px bg-slate-800 my-1" />

                {/* 3. DELETE OPTION */}
                <button
                    id="ctx-btn-delete"
                    onClick={() => {
                        onDelete(feature);
                        onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-red-400 hover:text-white hover:bg-red-600/80 transition-all cursor-pointer group"
                >
                    <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-white group-hover:text-red-600 transition-all">
                        <Trash2 size={13} />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wide">
                            {isKa ? "ობიექტის წაშლა" : "Delete Asset"}
                        </div>
                        <div className="text-[9px] text-red-300/80 font-normal">
                            {isKa ? "სამუდამოდ წაშლა რუკიდან" : "Remove permanently from map"}
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default MapFeatureContextMenu;
