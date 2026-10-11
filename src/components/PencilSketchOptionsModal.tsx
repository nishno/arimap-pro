import React, { useState, useEffect } from 'react';
import { 
    Trash2, Move, RefreshCw, X, Check, 
    Layers, ArrowRight, Sparkles, Sprout, 
    Maximize2, Droplets, Ruler, Car, FileText,
    MapPin, Plane, CheckCircle2, ShieldCheck,
    SlidersHorizontal, Eye, MessageSquare
} from 'lucide-react';
import type { PlantationFeature } from '../types';
import { safeStorage } from '../services/storageService';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export type PencilConvertChoice = 
    | 'keep'
    | 'note'
    | 'checkpoint'
    | 'drone_direction'
    | 'trench'
    | 'road'
    | 'area'
    | 'irrigation'
    | 'measure';

interface PencilSketchOptionsModalProps {
    feature: PlantationFeature | null;
    isOpen: boolean;
    onClose: () => void;
    onDelete: (id: string) => void;
    onUpdateFeature: (feature: PlantationFeature) => void;
    onGenerateSeedlingsForLine?: (lineFeature: PlantationFeature) => void;
    onOpenDroneSimulation?: (flightFeature: PlantationFeature) => void;
    onKeepAsIs?: (feature: PlantationFeature) => void;
}

export const PencilSketchOptionsModal: React.FC<PencilSketchOptionsModalProps> = ({
    feature,
    isOpen,
    onClose,
    onDelete,
    onUpdateFeature,
    onGenerateSeedlingsForLine,
    onOpenDroneSimulation,
    onKeepAsIs
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    // Default to 'keep' so conversion is completely optional and non-forced
    const [convertType, setConvertType] = useState<PencilConvertChoice>('keep');
    const [plantSpacing, setPlantSpacing] = useState<number>(2.5); // meters for trench
    const [noteText, setNoteText] = useState<string>('');
    const [noteCategory, setNoteCategory] = useState<'observation' | 'pest' | 'irrigation' | 'task'>('observation');
    const [droneAltitude, setDroneAltitude] = useState<number>(35); // meters
    const [sketchComment, setSketchComment] = useState<string>(feature?.comment || feature?.notes || '');
    const [showCommentOnMap, setShowCommentOnMap] = useState<boolean>(feature?.showCommentOnMap !== false);
    const [autoShowPopup, setAutoShowPopup] = useState<boolean>(() => {
        return safeStorage.getItem('agrimap_auto_open_pencil_modal') !== 'false';
    });

    useEffect(() => {
        if (feature) {
            setSketchComment(feature.comment || feature.notes || '');
            setShowCommentOnMap(feature.showCommentOnMap !== false);
        }
    }, [feature]);

    if (!isOpen || !feature) return null;

    const coords = (Array.isArray(feature.geometry) ? feature.geometry : []) as [number, number][];

    // Calculate approximate length in meters
    let totalLengthMeters = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i+1];
        if (p1 && p2 && Number.isFinite(p1[0]) && Number.isFinite(p2[0])) {
            const dLat = (p2[0] - p1[0]) * 111111;
            const dLng = (p2[1] - p1[1]) * 111111 * Math.cos((p1[0] * Math.PI) / 180);
            totalLengthMeters += Math.sqrt(dLat * dLat + dLng * dLng);
        }
    }

    // Centroid calculation for Note and Checkpoint points
    const validCoords = coords.filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const centerLat = validCoords.length > 0 ? validCoords.reduce((sum, p) => sum + p[0], 0) / validCoords.length : 41.7151;
    const centerLng = validCoords.length > 0 ? validCoords.reduce((sum, p) => sum + p[1], 0) / validCoords.length : 44.8271;

    const handleDelete = () => {
        onDelete(feature.id);
        onClose();
        toast.success(`Deleted sketch "${feature.name}"`);
    };

    const handleEnableMove = () => {
        toast.info("Move mode active. You can drag and reposition this sketch on the map.");
        onClose();
    };

    const handleToggleAutoPopup = (checked: boolean) => {
        setAutoShowPopup(checked);
        safeStorage.setItem('agrimap_auto_open_pencil_modal', checked ? 'true' : 'false');
        if (!checked) {
            toast.info("Auto-popup disabled. Sketches will now stay as drawings without asking.");
        } else {
            toast.success("Auto-popup enabled for pencil drawings.");
        }
    };

    const handleLeaveAsIs = () => {
        if (!feature) return;
        const kept: PlantationFeature = {
            ...feature,
            isPencil: true,
            subType: 'pencil',
            comment: sketchComment.trim() || undefined,
            showCommentOnMap: showCommentOnMap
        };
        if (onKeepAsIs) {
            onKeepAsIs(kept);
        } else {
            onUpdateFeature(kept);
        }
        toast.success(`Saved pencil sketch!${sketchComment.trim() ? (showCommentOnMap ? ' Displaying comment on map below draft pencil.' : ' Comment saved (hidden on map).') : ''}`);
        onClose();
    };

    const handleApply = () => {
        if (!feature) return;

        if (convertType === 'keep') {
            handleLeaveAsIs();
            return;
        }

        if (convertType === 'note') {
            const updated: PlantationFeature = {
                ...feature,
                type: 'note',
                monitoringType: 'sensor',
                geometry: [centerLat, centerLng],
                color: '#3b82f6',
                name: feature.name.replace(/sketch/gi, 'Note').trim() || 'Field Note',
                notes: noteText.trim() || feature.notes || `Field Note (${noteCategory}) converted from pencil sketch.`,
                isPencil: false,
                subType: undefined
            } as any;
            onUpdateFeature(updated);
            toast.success("Converted sketch to Field Observation Note marker!");
        } else if (convertType === 'checkpoint') {
            const updated: PlantationFeature = {
                ...feature,
                type: 'note',
                monitoringType: 'checkpoint',
                geometry: [centerLat, centerLng],
                color: '#8b5cf6',
                status: 'pending',
                name: feature.name.replace(/sketch/gi, 'Checkpoint').trim() || 'Scout Checkpoint',
                notes: noteText.trim() || feature.notes || 'Inspection checkpoint converted from pencil sketch.',
                isPencil: false,
                subType: undefined
            } as any;
            onUpdateFeature(updated);
            toast.success("Converted sketch to Field Inspection Checkpoint!");
        } else if (convertType === 'drone_direction') {
            const updated: PlantationFeature = {
                ...feature,
                type: 'line',
                lineType: 'path',
                subType: 'drone_direction',
                color: '#06b6d4',
                name: feature.name.replace(/sketch/gi, 'Drone Path').trim() || 'Drone Flight Direction',
                notes: `Drone survey direction corridor. Flight altitude: ${droneAltitude}m.`,
                isPencil: false
            } as any;
            onUpdateFeature(updated);
            toast.success(`Converted sketch to Drone Flight Direction Corridor (${droneAltitude}m alt)!`);
            if (onOpenDroneSimulation) {
                onOpenDroneSimulation(updated);
            }
        } else if (convertType === 'trench') {
            const calculatedPlants = Math.max(1, Math.round(totalLengthMeters / plantSpacing));
            const updated: PlantationFeature = {
                ...feature,
                type: 'trench',
                lineType: 'row',
                color: '#f97316',
                name: feature.name.includes('Sketch') ? feature.name.replace('Sketch', 'Trench Row') : `${feature.name} (Trench)`,
                calculatedPlantCount: calculatedPlants,
                defaultPlantSpacing: plantSpacing,
                subType: undefined,
                isPencil: false
            } as any;
            onUpdateFeature(updated);
            if (onGenerateSeedlingsForLine) {
                onGenerateSeedlingsForLine(updated);
            }
            toast.success(`Converted to Trench Row with ~${calculatedPlants} seedling positions!`);
        } else if (convertType === 'road') {
            const updated: PlantationFeature = {
                ...feature,
                type: 'line',
                lineType: 'road',
                color: '#78716c',
                name: feature.name.includes('Sketch') ? feature.name.replace('Sketch', 'Access Road') : `${feature.name} (Road)`,
                calculatedPlantCount: undefined,
                bundledSeedlings: undefined,
                subType: undefined,
                isPencil: false
            } as any;
            onUpdateFeature(updated);
            toast.success(`Converted to Vehicle Access Road!`);
        } else if (convertType === 'area') {
            // Close start & end points to make polygon
            const closedGeom = [...coords];
            if (coords.length > 2 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                closedGeom.push(coords[0]);
            }
            const updated: PlantationFeature = {
                ...feature,
                type: 'area',
                subType: 'sector',
                geometry: closedGeom,
                color: '#10b981',
                name: feature.name.includes('Sketch') ? feature.name.replace('Sketch', 'Field Sector') : `${feature.name} (Sector)`,
                isPencil: false
            } as any;
            onUpdateFeature(updated);
            toast.success(`Converted to Closed Field Sector Boundary!`);
        } else if (convertType === 'irrigation') {
            const updated: PlantationFeature = {
                ...feature,
                type: 'irrigation_line',
                lineType: 'irrigation',
                color: '#0284c7',
                name: feature.name.includes('Sketch') ? feature.name.replace('Sketch', 'Irrigation Main') : `${feature.name} (Irrigation)`,
                subType: undefined,
                isPencil: false
            } as any;
            onUpdateFeature(updated);
            toast.success(`Converted to Irrigation Pipe Line!`);
        } else if (convertType === 'measure') {
            toast.info(`📏 Measured Curve: Distance is ${totalLengthMeters.toFixed(1)} meters (${(totalLengthMeters / 1000).toFixed(2)} km).`);
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-5 text-white animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                {isKa ? 'ფანქრის მონახაზის პარამეტრები' : 'Pencil Drawing Options'}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                {feature.name} • {coords.length} {isKa ? 'წერტილი' : 'points'} • {totalLengthMeters.toFixed(1)}{isKa ? 'მ სიგრძე' : 'm length'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title={isKa ? "ფანჯრის დახურვა" : "Close window"}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto pr-1 py-3 space-y-4 flex-1 custom-scrollbar">

                    {/* Prominent "Leave As Is" Card */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 size={18} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-100">
                                    {isKa ? 'დატოვეთ მონახაზი უცვლელად' : 'Leave Drawing As It Is'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {isKa ? 'კონვერტაცია აუცილებელი არ არის. შეინახეთ თავისუფალი ფანქრის ჩანახატი რუკაზე.' : 'You do not need to convert. Keep it as a freehand pencil sketch on your map.'}
                                </div>
                            </div>
                        </div>
                        <button
                            id="btn-leave-sketch-as-is"
                            onClick={handleLeaveAsIs}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                        >
                            {isKa ? 'უცვლელად შენახვა' : 'Keep As Is'}
                        </button>
                    </div>

                    {/* Quick Utilities: Delete & Move */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            id="btn-sketch-delete"
                            onClick={handleDelete}
                            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 font-bold text-xs transition-all cursor-pointer group active:scale-95"
                        >
                            <Trash2 size={15} className="group-hover:scale-110 transition-transform text-rose-400" />
                            <span>{isKa ? 'ჩანახატის წაშლა' : 'Delete Sketch'}</span>
                        </button>

                        <button
                            id="btn-sketch-move"
                            onClick={handleEnableMove}
                            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-xl text-sky-300 font-bold text-xs transition-all cursor-pointer group active:scale-95"
                        >
                            <Move size={15} className="group-hover:scale-110 transition-transform text-sky-400" />
                            <span>{isKa ? 'წერტილების გადაადგილება' : 'Move Vertices'}</span>
                        </button>
                    </div>

                    {/* Conversion Choice Section */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <RefreshCw size={13} className="text-amber-400" />
                                <span>{isKa ? 'არჩევითი კონვერტაცია:' : 'Optional Conversion:'}</span>
                            </label>
                            <span className="text-[10px] text-slate-400">
                                {isKa ? 'აირჩიეთ მიზანი ან დატოვეთ ჩანახატად' : 'Select target or leave as drawing'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {/* 0. Keep Drawing */}
                            <button
                                id="opt-convert-keep"
                                onClick={() => setConvertType('keep')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'keep'
                                        ? 'bg-slate-800 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Eye size={15} className="text-emerald-400" />
                                    {convertType === 'keep' && <Check size={12} className="text-emerald-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'უცვლელად დატოვება' : 'Leave As Is'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'ჩანახატად შენახვა' : 'Keep drawing'}</div>
                                </div>
                            </button>

                            {/* 1. Convert to Note */}
                            <button
                                id="opt-convert-note"
                                onClick={() => setConvertType('note')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'note'
                                        ? 'bg-blue-500/20 border-blue-400 text-white shadow-md ring-1 ring-blue-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <FileText size={15} className="text-blue-400" />
                                    {convertType === 'note' && <Check size={12} className="text-blue-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'ჩანაწერად გადაქცევა' : 'Convert to Note'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'საველე შენიშვნა' : 'Field note pin'}</div>
                                </div>
                            </button>

                            {/* 2. Convert to Checkpoint */}
                            <button
                                id="opt-convert-checkpoint"
                                onClick={() => setConvertType('checkpoint')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'checkpoint'
                                        ? 'bg-purple-500/20 border-purple-400 text-white shadow-md ring-1 ring-purple-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <MapPin size={15} className="text-purple-400" />
                                    {convertType === 'checkpoint' && <Check size={12} className="text-purple-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'საკონტროლო წერტილი' : 'Convert to Checkpoint'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'დათვალიერება / ინსპექცია' : 'Scout / inspection'}</div>
                                </div>
                            </button>

                            {/* 3. Convert to Drone Direction */}
                            <button
                                id="opt-convert-drone-direction"
                                onClick={() => setConvertType('drone_direction')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'drone_direction'
                                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md ring-1 ring-cyan-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Plane size={15} className="text-cyan-400" />
                                    {convertType === 'drone_direction' && <Check size={12} className="text-cyan-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'დრონის მიმართულება' : 'Direction for Drones'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'ფრენის კორიდორი' : 'Survey corridor'}</div>
                                </div>
                            </button>

                            {/* 4. Convert to Trench Row */}
                            <button
                                id="opt-convert-trench"
                                onClick={() => setConvertType('trench')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'trench'
                                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Sprout size={15} className="text-amber-400" />
                                    {convertType === 'trench' && <Check size={12} className="text-amber-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'კვლის / რიგის ხაზი' : 'Trench Row'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? '+ ნერგების დარგვა' : '+ Plant seedlings'}</div>
                                </div>
                            </button>

                            {/* 5. Convert to Sector Area */}
                            <button
                                id="opt-convert-area"
                                onClick={() => setConvertType('area')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'area'
                                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Maximize2 size={15} className="text-emerald-400" />
                                    {convertType === 'area' && <Check size={12} className="text-emerald-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'სექტორის ფართობი' : 'Field Sector'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'პოლიგონის არეალი' : 'Polygon area'}</div>
                                </div>
                            </button>

                            {/* 6. Convert to Access Road */}
                            <button
                                id="opt-convert-road"
                                onClick={() => setConvertType('road')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'road'
                                        ? 'bg-stone-500/20 border-stone-300 text-white shadow-md ring-1 ring-stone-300/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Car size={15} className="text-stone-300" />
                                    {convertType === 'road' && <Check size={12} className="text-stone-300" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'მისასვლელი გზა' : 'Access Road'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'სატრანსპორტო ბილიკი' : 'Vehicle path'}</div>
                                </div>
                            </button>

                            {/* 7. Convert to Irrigation Line */}
                            <button
                                id="opt-convert-irrigation"
                                onClick={() => setConvertType('irrigation')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'irrigation'
                                        ? 'bg-sky-500/20 border-sky-400 text-white shadow-md ring-1 ring-sky-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Droplets size={15} className="text-sky-400" />
                                    {convertType === 'irrigation' && <Check size={12} className="text-sky-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'სარწყავი მილი' : 'Irrigation Line'}</div>
                                    <div className="text-[9px] text-slate-400">{isKa ? 'წყლის მაგისტრალი' : 'Water pipe'}</div>
                                </div>
                            </button>

                            {/* 8. Measure Distance */}
                            <button
                                id="opt-convert-measure"
                                onClick={() => setConvertType('measure')}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    convertType === 'measure'
                                        ? 'bg-violet-500/20 border-violet-400 text-white shadow-md ring-1 ring-violet-400/50'
                                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <Ruler size={15} className="text-violet-400" />
                                    {convertType === 'measure' && <Check size={12} className="text-violet-400" />}
                                </div>
                                <div className="mt-1.5">
                                    <div className="text-[11px] font-bold text-slate-200">{isKa ? 'მანძილის გაზომვა' : 'Measure Distance'}</div>
                                    <div className="text-[9px] text-slate-400">{totalLengthMeters.toFixed(1)}{isKa ? 'მ სიგრძე' : 'm length'}</div>
                                </div>
                            </button>
                        </div>

                        {/* Sub-parameters for Keep As Is (Comment field & Map Display toggle) */}
                        {convertType === 'keep' && (
                            <div className="pt-2.5 border-t border-slate-800 space-y-2 animate-in fade-in duration-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                                        <MessageSquare size={13} className="text-amber-400" />
                                        <span>{isKa ? 'მონახაზის კომენტარი:' : 'Pencil Sketch Comment:'}</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none text-[10px] font-bold text-slate-300 hover:text-white">
                                        <span>{isKa ? 'გამოჩნდეს რუკაზე მონახაზის ქვეშ' : 'Display on Map below Draft Pencil'}</span>
                                        <input
                                            type="checkbox"
                                            checked={showCommentOnMap}
                                            onChange={(e) => setShowCommentOnMap(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                                        />
                                    </label>
                                </div>
                                <textarea
                                    value={sketchComment}
                                    onChange={(e) => setSketchComment(e.target.value)}
                                    placeholder={isKa ? "დაამატეთ კომენტარი ან საველე დაკვირვება (გამოჩნდება რუკაზე დახატულ ადგილას)..." : "Add a comment or field observation (will be displayed on the map at the drawn location, below the draft pencil)..."}
                                    rows={2}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 placeholder:text-slate-500 resize-none"
                                />
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span>{isKa ? 'გამოისახება უშუალოდ რუკაზე მართვის ღილაკებთან ერთად.' : 'Displayed directly below "DRAFT PENCIL" badge on the map with on-map toggle & remove controls.'}</span>
                                </div>
                            </div>
                        )}

                        {/* Sub-parameters for Note / Checkpoint */}
                        {(convertType === 'note' || convertType === 'checkpoint') && (
                            <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in duration-100">
                                <label className="text-[10px] font-bold text-slate-300 block">
                                    {convertType === 'note' 
                                        ? (isKa ? 'დაკვირვების დეტალები:' : 'Observation Note Details:') 
                                        : (isKa ? 'საკონტროლო ინსპექციის დავალება:' : 'Checkpoint Inspection Task:')
                                    }
                                </label>
                                <input
                                    type="text"
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder={convertType === 'note' 
                                        ? (isKa ? 'მაგ. ჭირდება აზოტის სასუქი მე-3 რიგში...' : 'e.g. Needs nitrogen fertilizer in row 3...') 
                                        : (isKa ? 'მაგ. შემოწმდეს ნიადაგის ტენიანობა და წვეთოვანი სისტემა' : 'e.g. Inspect soil salinity and drip emitters')
                                    }
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                {convertType === 'note' && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-slate-400">{isKa ? 'კატეგორია:' : 'Category:'}</span>
                                        {(['observation', 'pest', 'irrigation', 'task'] as const).map(cat => {
                                            const catLabels: Record<string, { en: string; ka: string }> = {
                                                observation: { en: 'observation', ka: 'დაკვირვება' },
                                                pest: { en: 'pest', ka: 'მავნებელი' },
                                                irrigation: { en: 'irrigation', ka: 'მორწყვა' },
                                                task: { en: 'task', ka: 'დავალება' },
                                            };
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setNoteCategory(cat)}
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold capitalize ${
                                                        noteCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    {isKa ? catLabels[cat].ka : catLabels[cat].en}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sub-parameters for Drone Direction */}
                        {convertType === 'drone_direction' && (
                            <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in duration-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
                                        <Plane size={13} className="text-cyan-400" />
                                        <span>{isKa ? 'ფრენის სიმაღლე:' : 'Flight Survey Altitude:'}</span>
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {[20, 35, 50, 80].map(alt => (
                                            <button
                                                key={alt}
                                                onClick={() => setDroneAltitude(alt)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                                    droneAltitude === alt 
                                                        ? 'bg-cyan-500 text-slate-950 shadow-sm' 
                                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {alt}{isKa ? 'მ' : 'm'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    {isKa ? 'დრონები ზუსტად ამ დახატული კორიდორით იფრენენ ავტონომიური მისიის დროს.' : 'Drones will fly along this exact drawn corridor during autonomous surveys and mission simulations.'}
                                </p>
                            </div>
                        )}

                        {/* Sub-parameters for Trench */}
                        {convertType === 'trench' && (
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between animate-in fade-in duration-100">
                                <span className="text-[11px] text-slate-300 font-bold">{isKa ? 'ნერგებს შორის დაშორება:' : 'Plant Spacing:'}</span>
                                <div className="flex items-center gap-1.5">
                                    {[1.5, 2.5, 3.5, 5.0].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setPlantSpacing(s)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                                plantSpacing === s 
                                                    ? 'bg-amber-500 text-slate-950' 
                                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {s}{isKa ? 'მ' : 'm'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preference checkbox: Don't show automatically */}
                    <div className="flex items-center gap-2 px-1 text-slate-400 hover:text-slate-300 cursor-pointer text-[11px]">
                        <input
                            type="checkbox"
                            id="chk-auto-show-pencil"
                            checked={autoShowPopup}
                            onChange={(e) => handleToggleAutoPopup(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="chk-auto-show-pencil" className="cursor-pointer select-none">
                            {isKa ? 'ფანქრით ხატვის შემდეგ ამ დიალოგის ავტომატურად გახსნა' : 'Automatically open this dialog after drawing with pencil (uncheck to draw freely)'}
                        </label>
                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                    <button
                        id="btn-sketch-modal-leave"
                        onClick={handleLeaveAsIs}
                        className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                    >
                        {isKa ? 'ჩანახატად დატოვება' : 'Leave As Drawing'}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            id="btn-sketch-modal-close"
                            onClick={onClose}
                            className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>
                        <button
                            id="btn-sketch-modal-apply"
                            onClick={handleApply}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer ${
                                convertType === 'keep'
                                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                            }`}
                        >
                            <Check size={14} />
                            <span>{convertType === 'keep' ? (isKa ? 'უცვლელად შენახვა' : 'Keep As Is') : (isKa ? 'კონვერტაცია' : 'Apply Conversion')}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PencilSketchOptionsModal;
