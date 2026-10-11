import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import { toast } from 'sonner';
import type { PlantationFeature, AreaPlantationFeature, LinePlantationFeature, SeedlingPlantationFeature, SeedlingCondition, VarietyRule, LineType, NotePlantationFeature, Crop } from '../types';
import { SEEDLING_CONDITIONS } from '../types';
import { 
    TrashIcon, WrenchScrewdriverIcon, PlantIcon, TractorIcon, WaterDropIcon, InfoIcon,
    RectangleGroupIcon, ArrowLongRightIcon, PlusCircleIcon, MapPinIcon, PlusIcon, XIcon,
    MapIcon, ArrowsRightLeftIcon, CheckCircleIcon
} from './Icons';
import { Sparkles } from 'lucide-react';
import SeedlingGenerationModal from './SeedlingGenerationModal';
import { calculateLineLength, getSphericalPolygonArea } from '../services/geospatialService';
import { useLanguage } from '../contexts/LanguageContext';

interface DebouncedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string;
    onValueCommit: (val: string) => void;
}

const DebouncedInput: React.FC<DebouncedInputProps> = ({ value, onValueCommit, ...props }) => {
    const [localVal, setLocalVal] = useState(value);
    const initialValRef = useRef(value);
    
    useEffect(() => {
        setLocalVal(value);
        initialValRef.current = value;
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(e.target.value);
    };

    const handleBlur = () => {
        if (localVal !== initialValRef.current) {
            initialValRef.current = localVal;
            onValueCommit(localVal);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (localVal !== initialValRef.current) {
                initialValRef.current = localVal;
                onValueCommit(localVal);
            }
            e.currentTarget.blur();
        }
    };

    return (
        <input 
            {...props}
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
};

interface DebouncedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onValueCommit: (val: string) => void;
}

const DebouncedTextarea: React.FC<DebouncedTextareaProps> = ({ value, onValueCommit, ...props }) => {
    const [localVal, setLocalVal] = useState(value);
    const initialValRef = useRef(value);
    
    useEffect(() => {
        setLocalVal(value);
        initialValRef.current = value;
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalVal(e.target.value);
    };

    const handleBlur = () => {
        if (localVal !== initialValRef.current) {
            initialValRef.current = localVal;
            onValueCommit(localVal);
        }
    };

    return (
        <textarea 
            {...props}
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
        />
    );
};

interface InfoPanelProps {
  selectedFeatureIds: string[];
  plantationFeatures: PlantationFeature[];
  onUpdateFeature: (feature: PlantationFeature) => void;
  onDeleteItems: (ids: string[]) => void;
  onSelectFeature: (id: string | null, options?: { event?: MouseEvent; fromPanel?: boolean; }) => void;
  onSetFlyToBounds: (bounds: L.LatLngBoundsExpression) => void;
  onOpenTrenchModal: (feature: AreaPlantationFeature) => void;
  onGenerateTrenches: (params: { parentFeature: AreaPlantationFeature; distance: number; angle: number; plantSpacing: number; from: number; to: number; }) => void;
  onGenerateSeedlings: (trenchId: string, rules: VarietyRule[], spacing: number) => void;
  onAddSeedlingManually: (trenchId: string) => void;
  crops: Crop[];
  onOpenIrrigationModal: (feature: AreaPlantationFeature) => void;
  editingGeometryId?: string | null;
  onEditGeometry: (id: string | null) => void;
  onAddCropVariety?: (variety: string) => void;
  onOpenSpatialAnalysis?: (sectorId?: string) => void;
}

const DetailCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-slate-50/80 p-4 rounded-3xl border border-slate-100 space-y-2">
        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            {icon} {title}
        </h4>
        <div className="space-y-2.5">{children}</div>
    </div>
);

const DetailRow: React.FC<{ label: string; value: string | number; unit?: string }> = ({ label, value, unit }) => (
    <div className="flex justify-between items-baseline text-sm">
        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{label}</span>
        <span className="font-black text-slate-900 tracking-tight">
            {value} {unit && <span className="text-[10px] font-black text-slate-400 ml-0.5">{unit}</span>}
        </span>
    </div>
);

const AreaDetailsView: React.FC<{
  feature: AreaPlantationFeature;
  onOpenTrenchModal: () => void;
  onOpenIrrigationModal: () => void;
  onOpenSpatialAnalysis?: (sectorId?: string) => void;
  onDeleteItems: (ids: string[]) => void;
  onEditGeometry: () => void;
  isEditingThis: boolean;
  onUpdateFeature: (feature: PlantationFeature) => void;
  isKa?: boolean;
}> = ({ feature, onOpenTrenchModal, onOpenIrrigationModal, onOpenSpatialAnalysis, onDeleteItems, onEditGeometry, isEditingThis, onUpdateFeature, isKa }) => {
    const areaDetails = useMemo(() => {
        if (!feature.geometry || feature.geometry.length < 3) return { perimeter: 0, areaHa: 0 };
        const areaM2 = getSphericalPolygonArea(feature.geometry);
        return { perimeter: calculateLineLength([...feature.geometry, feature.geometry[0]]), areaHa: areaM2 / 10000 };
    }, [feature.geometry]);

    return (
        <div className="p-8 space-y-8 animate-fade-in font-sans">
            <div className="flex justify-between items-center">
                <div className="min-w-0 flex-1">
                    <DebouncedInput 
                        type="text"
                        value={feature.name}
                        onValueCommit={(val) => onUpdateFeature({ ...feature, name: val })}
                        className="font-black text-3xl text-slate-900 uppercase tracking-tighter truncate leading-tight bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-emerald-100 rounded-lg"
                    />
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mt-1">
                        {isKa ? 'სივრცითი ობიექტი: ნაკვეთი' : 'Spatial Asset: Area'}
                    </p>
                </div>
            </div>

            <DetailCard title={isKa ? 'გაზომვები' : 'Measurements'} icon={<RectangleGroupIcon className="h-4 w-4"/>}>
                <DetailRow label={isKa ? 'მთლიანი ფართობი' : 'Total Surface'} value={areaDetails.areaHa.toFixed(4)} unit="ha" />
                <DetailRow label={isKa ? 'გარე პერიმეტრი' : 'Outer Perimeter'} value={areaDetails.perimeter.toFixed(1)} unit="m" />
            </DetailCard>

            <div className="grid grid-cols-1 gap-3">
                {onOpenSpatialAnalysis && (
                    <button 
                        onClick={() => onOpenSpatialAnalysis(feature.id)}
                        className="flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 hover:from-emerald-600 hover:to-teal-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-700/20 transition-all active:scale-95 cursor-pointer"
                    >
                        <div className="p-2 bg-white/15 rounded-xl">
                            <Sparkles className="h-6 w-6 text-emerald-300"/>
                        </div>
                        <div className="text-left">
                            <span className="block">{isKa ? 'AI სივრცითი ანალიზატორი' : 'AI Spatial Analyzer'}</span>
                            <span className="text-[9px] text-emerald-200/90 font-medium normal-case block">
                                {isKa ? 'ამ ნაკვეთის აზიმუტის, რიგებისა და ნერგების ანალიზი' : 'Analyze selected plot boundaries & capacity'}
                            </span>
                        </div>
                    </button>
                )}
                <button onClick={onOpenTrenchModal} className="flex items-center gap-4 p-5 bg-teal-600 hover:bg-teal-700 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-teal-100 transition-all active:scale-95 cursor-pointer">
                    <div className="p-2 bg-white/10 rounded-xl"><TractorIcon className="h-6 w-6"/></div>
                    {isKa ? 'რიგების / თხრილების გენერირება' : 'Generate Row Trenches'}
                </button>
                <button onClick={onOpenIrrigationModal} className="flex items-center gap-4 p-5 bg-sky-600 hover:bg-sky-700 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-sky-100 transition-all active:scale-95 cursor-pointer">
                    <div className="p-2 bg-white/10 rounded-xl"><WaterDropIcon className="h-6 w-6"/></div>
                    {isKa ? 'სარწყავი ბადის დაპროექტება' : 'Design Irrigation Grid'}
                </button>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
                <button 
                    onClick={() => {
                        const currentStatus = (feature as any).status || 'active';
                        const nextStatus = currentStatus === 'completed' ? 'active' : 'completed';
                        onUpdateFeature({ ...feature, status: nextStatus } as any);
                    }} 
                    className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 transition-all cursor-pointer ${(feature as any).status === 'completed' ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 border-slate-100 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 shadow-sm'}`}
                >
                    <CheckCircleIcon className="h-5 w-5"/> {isKa ? 'ნაკვეთის სტატუსი:' : 'Area Status:'} {((feature as any).status || 'active').toUpperCase()}
                </button>
                <button onClick={onEditGeometry} className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 transition-all cursor-pointer ${isEditingThis ? 'bg-slate-900 border-slate-900 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:shadow-xl'}`}>
                    <WrenchScrewdriverIcon className="h-5 w-5"/> {isKa ? (isEditingThis ? 'ცვლილებების დასრულება' : 'გეომეტრიის შეცვლა') : (isEditingThis ? 'Finalize Changes' : 'Modify Geometry')}
                </button>
                <button onClick={() => { if (confirm(isKa ? 'ნამდვილად გსურთ ობიექტის სამუდამოდ წაშლა?' : `Confirm permanent deletion?`)) onDeleteItems([feature.id]); }} className="w-full py-5 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center hover:bg-red-100 transition-all font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer">
                    <TrashIcon className="h-5 w-5 mr-3"/> {isKa ? 'ობიექტის წაშლა' : 'Erase Asset'}
                </button>
            </div>
        </div>
    );
};

const LineDetailsView: React.FC<{
  feature: LinePlantationFeature;
  plantationFeatures: PlantationFeature[];
  onOpenSeedlingModal: () => void;
  onAddSeedlingManually: () => void;
  onDeleteItems: (ids: string[]) => void;
  onEditGeometry: () => void;
  isEditingThis: boolean;
  onUpdateFeature: (feature: PlantationFeature) => void;
  isKa?: boolean;
}> = ({ feature, plantationFeatures, onOpenSeedlingModal, onAddSeedlingManually, onDeleteItems, onEditGeometry, isEditingThis, onUpdateFeature, isKa }) => {
    const length = useMemo(() => calculateLineLength(feature.geometry), [feature.geometry]);
    const childCount = useMemo(() => plantationFeatures.filter(f => f.parentId === feature.id).length, [plantationFeatures, feature.id]);
    const isTrench = feature.type === 'trench';

    return (
        <div className="p-6 space-y-6 animate-fade-in text-slate-800">
            <div className="flex justify-between items-center bg-white/50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                <div className="min-w-0 flex-1">
                    <DebouncedInput 
                        type="text"
                        value={feature.name}
                        onValueCommit={(val) => onUpdateFeature({ ...feature, name: val })}
                        className="font-black text-2xl text-slate-900 uppercase tracking-tighter truncate leading-tight bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-orange-100 rounded-lg pr-4"
                    />
                    <p className={`text-[9px] font-black uppercase tracking-[0.3em] mt-0.5 ${isTrench ? 'text-amber-600' : 'text-orange-600'}`}>
                        {isKa ? (isTrench ? 'აგრო ობიექტი: თხრილი' : 'სივრცითი ობიექტი: ხაზი/ბილიკი') : (isTrench ? 'Agricultural Asset: Trench' : 'Spatial Asset: Path/Line')}
                    </p>
                </div>
                {isTrench && (
                    <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                        <PlusCircleIcon className="h-5 w-5" />
                    </div>
                )}
            </div>

            <div className="space-y-4">

                <DetailCard title={isKa ? (isTrench ? "თხრილის პარამეტრები" : "ხაზის ტიპი") : (isTrench ? "Trench Engineering" : "Line Identity")} icon={isTrench ? <TractorIcon className="h-3 w-3"/> : <ArrowLongRightIcon className="h-3 w-3"/>}>
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">{isKa ? 'კლასის ტიპი' : 'Class Type'}</label>
                    <select 
                        value={feature.lineType || 'row'} 
                        onChange={(e) => onUpdateFeature({...feature, lineType: e.target.value as LineType} as LinePlantationFeature)}
                        className="w-full p-3 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-800 outline-none focus:ring-4 focus:ring-blue-100"
                    >
                        <option value="row">{isKa ? (isTrench ? 'თხრილი (სტანდარტული)' : 'საწარმოო რიგი') : (isTrench ? 'Trench (Standard)' : 'Production Row')}</option>
                        <option value="path">{isKa ? 'საფეხმავლო ბილიკი' : 'Pedestrian Path'}</option>
                        <option value="road">{isKa ? 'სატრანსპორტო გზა' : 'Vehicle Service Road'}</option>
                        <option value="irrigation">{isKa ? 'სარწყავი მაგისტრალი' : 'Irrigation Main Line'}</option>
                    </select>
                </DetailCard>

                <div className="grid grid-cols-2 gap-3">
                    <DetailCard title={isKa ? "ხაზოვანი ზომა" : "Linear Scale"} icon={<InfoIcon className="h-3 w-3 text-orange-500"/>}>
                        <p className="text-2xl font-black text-slate-800 tracking-tighter">{length.toFixed(1)}<span className="text-xs font-bold text-slate-400 ml-1">{isKa ? 'მ' : 'M'}</span></p>
                    </DetailCard>
                    <DetailCard title={isKa ? "სიგანე" : "Refine Width"} icon={<InfoIcon className="h-3 w-3 text-blue-500"/>}>
                        <div className="flex items-baseline gap-1">
                            <DebouncedInput 
                                type="number" 
                                step="0.1"
                                value={String(feature.widthMeters || 0.6)} 
                                onValueCommit={(val) => onUpdateFeature({...feature, widthMeters: parseFloat(val) || 0} as LinePlantationFeature)}
                                className="text-2xl font-black text-slate-800 tracking-tighter bg-transparent w-full outline-none focus:text-indigo-600 transition-colors"
                            />
                            <span className="text-xs font-bold text-slate-400 uppercase">{isKa ? 'მ' : 'M'}</span>
                       </div>
                    </DetailCard>
                </div>

                <DetailCard title={isKa ? "მოსახლეობის ანალიტიკა" : "Population Analytics"} icon={<InfoIcon className="h-3 w-3 text-emerald-500"/>}>
                    <DetailRow label={isKa ? "საპროექტო ლიმიტი" : "Design Limit"} value={feature.calculatedPlantCount || 0} unit={isKa ? "ძირი" : "plants"} />
                    <DetailRow label={isKa ? "რეალური აღწერა" : "Live Census"} value={childCount} unit={isKa ? "ერთ." : "items"} />
                </DetailCard>

                <div className="grid grid-cols-1 gap-2">
                    <button 
                        onClick={onOpenSeedlingModal} 
                        className="flex items-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95 group cursor-pointer"
                    >
                        <div className="p-1.5 bg-white/10 rounded-lg group-hover:rotate-12 transition-transform"><PlusCircleIcon className="h-5 w-5"/></div>
                        {isKa ? (isTrench ? 'თხრილის შევსება (ავტო)' : 'ნერგების გენერირება (ავტო)') : (isTrench ? 'Populate Trench (Auto)' : 'Generate Seeds (Auto)')}
                    </button>
                    <button 
                        onClick={onAddSeedlingManually} 
                        className="flex items-center gap-3 p-4 bg-white border border-slate-100 hover:border-emerald-200 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                        <div className="p-1.5 bg-emerald-50 rounded-lg"><PlusIcon className="h-5 w-5"/></div>
                        {isKa ? 'ნერგის ხელით დამატება' : 'Add Plant Manually'}
                    </button>
                </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 space-y-2">
                <button 
                    onClick={() => {
                        const currentStatus = (feature as any).status || 'active';
                        const nextStatus = currentStatus === 'completed' ? 'active' : 'completed';
                        onUpdateFeature({ ...feature, status: nextStatus } as any);
                    }} 
                    className={`w-full py-4 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${(feature as any).status === 'completed' ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 border-slate-100 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 shadow-sm'}`}
                >
                    <CheckCircleIcon className="h-4 w-4"/> {isKa ? 'სტატუსი:' : 'Status:'} {((feature as any).status || 'active').toUpperCase()}
                </button>
                <button onClick={onEditGeometry} className={`w-full py-4 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${isEditingThis ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:shadow-xl shadow-sm'}`}>
                    <WrenchScrewdriverIcon className="h-4 w-4"/> {isKa ? (isEditingThis ? 'მონიშვნის ჩაკეტვა' : 'ხაზის გეომეტრიის შეცვლა') : (isEditingThis ? 'Lock Selection' : 'Refine Trench Path')}
                </button>
                <button 
                    onClick={() => { if (confirm(isKa ? `წაიშალოს ეს ${isTrench ? 'თხრილი' : 'ხაზი'}?` : `Erase this ${isTrench ? 'trench' : 'path'}?`)) onDeleteItems([feature.id]); }} 
                    className="w-full py-4 text-red-600 hover:bg-red-50 rounded-2xl flex items-center justify-center transition-all font-black text-[9px] uppercase tracking-[0.2em] group cursor-pointer"
                >
                    <TrashIcon className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform"/> {isKa ? 'ობიექტის წაშლა' : 'Wipe Asset'}
                </button>
            </div>
        </div>
    );
};

const NoteDetailsView: React.FC<{
  feature: NotePlantationFeature;
  onUpdateFeature: (f: PlantationFeature) => void;
  onDeleteItems: (ids: string[]) => void;
  onEditGeometry: () => void;
  isEditingThis: boolean;
  isKa?: boolean;
}> = ({ feature, onUpdateFeature, onDeleteItems, onEditGeometry, isEditingThis, isKa }) => {
    return (
        <div className="p-8 space-y-8 animate-fade-in">
            <div className="min-w-0 flex-1">
                <DebouncedInput 
                    type="text"
                    value={feature.name}
                    onValueCommit={(val) => onUpdateFeature({ ...feature, name: val })}
                    className="font-black text-3xl text-slate-900 uppercase tracking-tighter truncate leading-tight bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-indigo-100 rounded-lg"
                />
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mt-1">
                    {isKa ? 'სივრცითი ობიექტი: აღნიშვნა' : 'Spatial Asset: Placemark'}
                </p>
            </div>
            
            <DetailCard title={isKa ? "ფუნქციონალი" : "Functionality"} icon={<MapPinIcon className="h-4 w-4"/>}>
                <div className="grid grid-cols-3 gap-2">
                    {(['checkpoint', 'camera', 'sensor'] as const).map(type => {
                        const labels: Record<string, string> = {
                            checkpoint: isKa ? 'საგუშაგო' : 'checkpoint',
                            camera: isKa ? 'კამერა' : 'camera',
                            sensor: isKa ? 'სენსორი' : 'sensor'
                        };
                        return (
                            <button key={type} onClick={() => onUpdateFeature({ ...feature, monitoringType: type } as NotePlantationFeature)} className={`py-3 px-1 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all cursor-pointer ${feature.monitoringType === type ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}>{labels[type] || type}</button>
                        );
                    })}
                </div>
            </DetailCard>

            <DetailCard title={isKa ? "შენიშვნები" : "Registry Notes"} icon={<InfoIcon className="h-4 w-4"/>}>
                <DebouncedTextarea 
                    value={feature.notes || ''} 
                    onValueCommit={val => onUpdateFeature({...feature, notes: val} as NotePlantationFeature)} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50"
                    rows={6}
                    placeholder={isKa ? "შეიყვანეთ დაკვირვების შენიშვნა..." : "Enter site observations..."}
                />
            </DetailCard>
            
            <div className="pt-4 border-t border-slate-100 space-y-3">
                <button onClick={onEditGeometry} className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 transition-all cursor-pointer ${isEditingThis ? 'bg-slate-900 border-slate-900 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:shadow-xl'}`}>
                    <WrenchScrewdriverIcon className="h-5 w-5"/> {isKa ? (isEditingThis ? 'მონიშვნის ჩაკეტვა' : 'მარკერის გადაადგილება') : (isEditingThis ? 'Lock Marker' : 'Reposition Marker')}
                </button>
                <button onClick={() => { if (confirm(isKa ? `წაიშალოს ეს აღნიშვნა?` : `Remove this placemark?`)) onDeleteItems([feature.id]); }} className="w-full py-5 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer">
                    <TrashIcon className="h-5 w-5 mr-3"/> {isKa ? 'აღნიშვნის წაშლა' : 'Erase Asset'}
                </button>
            </div>
        </div>
    );
};

const SeedlingDetailsView: React.FC<{
  feature: SeedlingPlantationFeature;
  onUpdateFeature: (f: PlantationFeature) => void;
  onDeleteItems: (ids: string[]) => void;
  onEditGeometry: () => void;
  isEditingThis: boolean;
  cropVarieties: string[];
  onAddCropVariety?: (variety: string) => void;
  isKa?: boolean;
}> = ({ feature, onUpdateFeature, onDeleteItems, onEditGeometry, isEditingThis, cropVarieties, onAddCropVariety, isKa }) => {
    const conditionLabels: Record<string, string> = {
        'Good': isKa ? 'კარგი' : 'Good',
        'Suspicious': isKa ? 'საეჭვო' : 'Suspicious',
        'Dried': isKa ? 'გამხმარი' : 'Dried'
    };

    return (
        <div className="p-8 space-y-8 animate-fade-in">
             <div className="min-w-0 flex-1">
                <DebouncedInput 
                    type="text"
                    value={feature.name}
                    onValueCommit={(val) => onUpdateFeature({ ...feature, name: val })}
                    className="font-black text-3xl text-slate-900 uppercase tracking-tighter truncate leading-tight bg-transparent border-none outline-none w-full focus:ring-2 focus:ring-emerald-100 rounded-lg pr-4"
                />
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mt-1">
                    {isKa ? 'სივრცითი ობიექტი: ინდივიდუალური ნერგი' : 'Spatial Asset: Plant Individual'}
                </p>
            </div>

            <DetailCard title={isKa ? "მცენარის მდგომარეობა" : "Plant Health Pulse"} icon={<PlantIcon className="h-4 w-4"/>}>
                <div className="grid grid-cols-3 gap-2">
                    {SEEDLING_CONDITIONS.map(cond => {
                        const colors = {
                            'Good': 'bg-emerald-600 border-emerald-600',
                            'Suspicious': 'bg-amber-500 border-amber-500',
                            'Dried': 'bg-red-500 border-red-500'
                        };
                        const isActive = feature.condition === cond;
                        return (
                            <button 
                                key={cond} 
                                onClick={() => onUpdateFeature({ ...feature, condition: cond } as any)} 
                                className={`py-3 px-1 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all cursor-pointer ${isActive ? `${colors[cond]} text-white shadow-lg` : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                            >
                                {conditionLabels[cond] || cond}
                            </button>
                        );
                    })}
                </div>
            </DetailCard>
            <DetailCard title={isKa ? "ჯიშის კონტროლი" : "Variety Control"} icon={<InfoIcon className="h-4 w-4"/>}>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <DebouncedInput 
                            list="varieties-list"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-4 focus:ring-blue-50"
                            value={feature.cropVariety || ''}
                            onValueCommit={newVariety => {
                                const parts = feature.name.split(' ');
                                const indexStr = parts[parts.length - 1];
                                const newName = `${newVariety.toUpperCase()} ${indexStr}`;
                                onUpdateFeature({ ...feature, cropVariety: newVariety, name: newName } as any);
                            }}
                            placeholder={isKa ? "შეიყვანეთ ან აირჩიეთ ჯიში" : "TYPE OR SELECT VARIETY"}
                        />
                        <datalist id="varieties-list">
                            {cropVarieties.map(v => <option key={v} value={v} />)}
                        </datalist>
                    </div>
                    <button 
                        onClick={() => {
                            if (feature.cropVariety && onAddCropVariety && !cropVarieties.includes(feature.cropVariety)) {
                                onAddCropVariety(feature.cropVariety);
                                toast.success(isKa ? `რეგისტრირებულია: ${feature.cropVariety}` : `Registered: ${feature.cropVariety}`);
                            }
                        }}
                        className="p-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all flex-shrink-0 cursor-pointer"
                        title={isKa ? "ჯიშის რეგისტრაცია" : "Register Variety"}
                    >
                        <PlusIcon className="h-4 w-4" />
                    </button>
                </div>
            </DetailCard>
            <div className="pt-4 border-t border-slate-100 space-y-3">
                <button 
                    onClick={() => {
                        const currentStatus = (feature as any).status || 'active';
                        const nextStatus = currentStatus === 'completed' ? 'active' : 'completed';
                        onUpdateFeature({ ...feature, status: nextStatus } as any);
                    }} 
                    className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 transition-all cursor-pointer ${(feature as any).status === 'completed' ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-100' : 'bg-slate-100 border-slate-100 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 shadow-sm'}`}
                >
                    <CheckCircleIcon className="h-5 w-5"/> {isKa ? 'ნერგის სტატუსი:' : 'Plant Status:'} {((feature as any).status || 'active').toUpperCase()}
                </button>
                <button onClick={onEditGeometry} className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 transition-all cursor-pointer ${isEditingThis ? 'bg-slate-900 border-slate-900 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:shadow-xl'}`}>
                    <WrenchScrewdriverIcon className="h-5 w-5"/> {isKa ? (isEditingThis ? 'ფესვის ჩაკეტვა' : 'ფესვის ადგილის შეცვლა') : (isEditingThis ? 'Lock Root' : 'Move Root Position')}
                </button>
                <button onClick={() => { if (confirm(isKa ? `წაიშალოს ნერგი რეესტრიდან?` : `Remove plant from registry?`)) onDeleteItems([feature.id]); }} className="w-full py-5 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer">
                    <TrashIcon className="h-5 w-5 mr-3"/> {isKa ? 'ჩანაწერის წაშლა' : 'Erase Record'}
                </button>
            </div>
        </div>
    );
};

const InfoPanel: React.FC<InfoPanelProps> = (props) => {
    const { 
        selectedFeatureIds, 
        plantationFeatures, 
        onDeleteItems, 
        onOpenTrenchModal, 
        onOpenIrrigationModal, 
        onGenerateTrenches, 
        onGenerateSeedlings, 
        onAddSeedlingManually, 
        onEditGeometry, 
        editingGeometryId, 
        onUpdateFeature, 
        crops, 
        onAddCropVariety,
        onOpenSpatialAnalysis
    } = props;
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [isSeedlingModalOpen, setIsSeedlingModalOpen] = useState(false);

    const cropVarieties = useMemo(() => {
        const varieties = new Set<string>();
        crops?.forEach(c => {
            c.varieties?.forEach(v => varieties.add(v));
        });
        return Array.from(varieties);
    }, [crops]);
    
    const feature = useMemo(() => {
        if (selectedFeatureIds.length !== 1) return null;
        const targetId = selectedFeatureIds[0];
        
        const findFeatureRecursive = (features: PlantationFeature[]): PlantationFeature | null => {
            for (const f of features) {
                if (f.id === targetId) return f;
                
                if (f.type === 'area' || f.type === 'sector') {
                    const area = f as AreaPlantationFeature;
                    if (area.bundledLines) {
                        const found = findFeatureRecursive(area.bundledLines);
                        if (found) return found;
                    }
                }
                
                if (f.type === 'line' || f.type === 'trench') {
                    const line = f as LinePlantationFeature;
                    if (line.bundledSeedlings) {
                        const found = findFeatureRecursive(line.bundledSeedlings);
                        if (found) return found;
                    }
                }
            }
            return null;
        };

        return findFeatureRecursive(plantationFeatures);
    }, [selectedFeatureIds, plantationFeatures]);

    if (!feature) return (
        <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-50/20 font-sans">
            <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-8 border border-white shadow-inner"><MapPinIcon size={40} /></div>
            <h3 className="font-black text-slate-800 uppercase text-lg tracking-tighter leading-none">
                {isKa ? 'ობიექტის დეტალები' : 'Inspect Feature'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mt-4 leading-relaxed max-w-[200px]">
                {isKa ? 'აირჩიეთ ობიექტი რუკაზე მისი პარამეტრების სანახავად.' : 'Select a map object to view its spatial profile and metadata.'}
            </p>
        </div>
    );

    return (
        <div className="h-full flex flex-col relative overflow-y-auto custom-scrollbar">
            {(feature.type === 'area' || feature.type === 'sector' || feature.type === 'boundary') && (
                <AreaDetailsView 
                    feature={feature as AreaPlantationFeature} 
                    onOpenTrenchModal={() => onOpenTrenchModal(feature as AreaPlantationFeature)} 
                    onOpenIrrigationModal={() => onOpenIrrigationModal(feature as AreaPlantationFeature)} 
                    onOpenSpatialAnalysis={onOpenSpatialAnalysis}
                    onDeleteItems={onDeleteItems} 
                    onEditGeometry={() => onEditGeometry(editingGeometryId === feature.id ? null : feature.id)} 
                    isEditingThis={editingGeometryId === feature.id} 
                    onUpdateFeature={onUpdateFeature} 
                    isKa={isKa}
                />
            )}
            {(feature.type === 'line' || feature.type === 'trench' || feature.type === 'irrigation_line') && (
                <LineDetailsView 
                    feature={feature as LinePlantationFeature} 
                    plantationFeatures={plantationFeatures} 
                    onOpenSeedlingModal={() => setIsSeedlingModalOpen(true)} 
                    onAddSeedlingManually={() => onAddSeedlingManually(feature.id)} 
                    onDeleteItems={onDeleteItems} 
                    onEditGeometry={() => onEditGeometry(editingGeometryId === feature.id ? null : feature.id)} 
                    isEditingThis={editingGeometryId === feature.id} 
                    onUpdateFeature={onUpdateFeature} 
                    isKa={isKa}
                />
            )}
            {feature.type === 'seedling' && (
                <SeedlingDetailsView 
                    feature={feature as SeedlingPlantationFeature} 
                    onUpdateFeature={onUpdateFeature} 
                    onDeleteItems={onDeleteItems} 
                    onEditGeometry={() => onEditGeometry(editingGeometryId === feature.id ? null : feature.id)} 
                    isEditingThis={editingGeometryId === feature.id} 
                    cropVarieties={cropVarieties} 
                    onAddCropVariety={onAddCropVariety} 
                    isKa={isKa}
                />
            )}
            {feature.type === 'note' && (
                <NoteDetailsView 
                    feature={feature as NotePlantationFeature} 
                    onUpdateFeature={onUpdateFeature} 
                    onDeleteItems={onDeleteItems} 
                    onEditGeometry={() => onEditGeometry(editingGeometryId === feature.id ? null : feature.id)} 
                    isEditingThis={editingGeometryId === feature.id} 
                    isKa={isKa}
                />
            )}
            
            {(isSeedlingModalOpen && (feature.type === 'line' || feature.type === 'trench')) && (
                <SeedlingGenerationModal 
                    isOpen={isSeedlingModalOpen} 
                    onClose={() => setIsSeedlingModalOpen(false)} 
                    cropVarieties={cropVarieties} 
                    maxPlants={(feature as LinePlantationFeature).calculatedPlantCount || 100} 
                    lineLength={calculateLineLength(feature.geometry)}
                    featureName={feature.name}
                    defaultSpacing={(feature as LinePlantationFeature).defaultPlantSpacing}
                    onAddCropVariety={onAddCropVariety}
                    onGenerate={(rules, spacing) => { onGenerateSeedlings(feature.id, rules, spacing); setIsSeedlingModalOpen(false); }} 
                />
            )}
            <style>{`.animate-fade-in { animation: fadeIn 0.4s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
    );
};

export default InfoPanel;