import React, { useState, useMemo } from 'react';
import { 
    X, MapPin, Ruler, Layers, Calendar, FileText, CheckCircle2, 
    Briefcase, Sparkles, Hash, Compass, Tag
} from 'lucide-react';
import type { 
    WorkAssignment, 
    OperationalLog, 
    AreaPlantationFeature, 
    LinePlantationFeature, 
    PlantationFeature,
    User
} from '../types';
import { getSphericalPolygonArea } from '../services/geospatialService';
import { useLanguage } from '../contexts/LanguageContext';

interface OperationalAreaLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    geometry: [number, number][];
    workAssignments: WorkAssignment[];
    initialAssignmentId?: string | null;
    plantationFeatures: PlantationFeature[];
    activeOrgId?: string;
    currentUser?: User | null;
    onSaveLog: (log: OperationalLog, linkedWork?: WorkAssignment) => void;
}

// Calculate approximate perimeter / line length in meters
function calculatePerimeterMeters(coords: [number, number][]): number {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    const R = 6371000; // Earth radius in meters
    for (let i = 0; i < coords.length; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % coords.length];
        const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
        const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        total += R * c;
    }
    return total;
}

export const OperationalAreaLogModal: React.FC<OperationalAreaLogModalProps> = ({
    isOpen,
    onClose,
    geometry,
    workAssignments,
    initialAssignmentId,
    plantationFeatures,
    activeOrgId,
    currentUser,
    onSaveLog
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    // Calculate Measurements
    const { areaHa, areaM2, perimeterM } = useMemo(() => {
        if (!geometry || geometry.length < 3) {
            return { areaHa: 0, areaM2: 0, perimeterM: 0 };
        }
        try {
            const rawArea = getSphericalPolygonArea(geometry);
            const m2 = Math.round(rawArea);
            const ha = rawArea / 10000;
            const peri = calculatePerimeterMeters(geometry);
            return { areaHa: ha, areaM2: m2, perimeterM: Math.round(peri) };
        } catch (e) {
            return { areaHa: 0, areaM2: 0, perimeterM: 0 };
        }
    }, [geometry]);

    // Available sectors (Area features)
    const sectors = useMemo(() => {
        return (plantationFeatures || []).filter(f => f.type === 'area') as AreaPlantationFeature[];
    }, [plantationFeatures]);

    // Detect Overlapping Trenches & Crops from geometry
    const detectedInfo = useMemo(() => {
        if (!geometry || geometry.length < 3) {
            return { trenchCount: 0, cropCount: 0, sectorId: '', suggestedRange: '' };
        }

        // Bounding box
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        geometry.forEach(p => {
            if (p[0] < minLat) minLat = p[0];
            if (p[0] > maxLat) maxLat = p[0];
            if (p[1] < minLng) minLng = p[1];
            if (p[1] > maxLng) maxLng = p[1];
        });

        // Detect overlapping rows/trenches
        const trenches = (plantationFeatures || []).filter(f => {
            if (f.type !== 'line' || (f as LinePlantationFeature).lineType !== 'row') return false;
            const geom = (f as LinePlantationFeature).geometry;
            if (!Array.isArray(geom) || geom.length === 0) return false;
            return geom.some((pt: any) => {
                const lat = Array.isArray(pt) ? pt[0] : pt?.lat;
                const lng = Array.isArray(pt) ? pt[1] : pt?.lng;
                return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
            });
        }) as LinePlantationFeature[];

        const trenchIds = new Set(trenches.map(t => t.id));
        const crops = (plantationFeatures || []).filter(f => 
            f.type === 'seedling' && f.parentId && trenchIds.has(f.parentId)
        ).length;

        // Detect sector containing the center or points
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const matchedSector = sectors.find(s => {
            const sGeom = (s as any).geometry;
            if (!Array.isArray(sGeom) || sGeom.length < 3) return false;
            let sMinLat = Infinity, sMaxLat = -Infinity;
            let sMinLng = Infinity, sMaxLng = -Infinity;
            sGeom.forEach((p: any) => {
                const lat = Array.isArray(p) ? p[0] : p?.lat;
                const lng = Array.isArray(p) ? p[1] : p?.lng;
                if (lat < sMinLat) sMinLat = lat;
                if (lat > sMaxLat) sMaxLat = lat;
                if (lng < sMinLng) sMinLng = lng;
                if (lng > sMaxLng) sMaxLng = lng;
            });
            return centerLat >= sMinLat && centerLat <= sMaxLat && centerLng >= sMinLng && centerLng <= sMaxLng;
        });

        let suggestedRange = '';
        if (trenches.length > 0) {
            suggestedRange = `Trench 1 – ${trenches.length} (${trenches.length} detected)`;
        }

        return {
            trenchCount: trenches.length,
            cropCount: crops,
            sectorId: matchedSector?.id || (sectors.length > 0 ? sectors[0].id : ''),
            suggestedRange
        };
    }, [geometry, plantationFeatures, sectors]);

    // Form state
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
        initialAssignmentId || (workAssignments[0]?.id || 'new')
    );
    const [customTaskName, setCustomTaskName] = useState<string>('');
    const [selectedSectorId, setSelectedSectorId] = useState<string>(detectedInfo.sectorId);
    const [trenchRange, setTrenchRange] = useState<string>(detectedInfo.suggestedRange || 'Trench 1 - 10');
    const [trenchCount, setTrenchCount] = useState<number>(detectedInfo.trenchCount || 0);
    const [cropCount, setCropCount] = useState<number>(detectedInfo.cropCount || 0);
    const [notes, setNotes] = useState<string>('');
    const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    const handleSave = () => {
        let finalAssignmentId = selectedAssignmentId;
        let createdWork: WorkAssignment | undefined = undefined;

        if (selectedAssignmentId === 'new') {
            const taskTitle = customTaskName.trim() || (isKa ? 'ახალი საველე ოპერაცია' : 'Field Operation Log');
            finalAssignmentId = `work-${Date.now()}`;
            createdWork = {
                id: finalAssignmentId,
                organizationId: activeOrgId,
                workName: taskTitle,
                date: new Date(logDate).toISOString(),
                status: 'in-progress',
                taskType: 'Other',
                assignedEmployeeIds: [],
                employeeHours: [],
                sectorIds: selectedSectorId ? [selectedSectorId] : [],
                notes: notes || `Operational log for ${taskTitle}`,
                source: 'tasks',
                complexity: 'solo',
                plannedTime: 2,
                changeHistory: [{
                    id: `audit-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    userName: currentUser?.name || 'Administrator',
                    userEmail: currentUser?.email || '',
                    action: 'Task Created via Map Log',
                    details: `Created task ${taskTitle} with ${areaM2} m² area.`
                }]
            };
        }

        const selectedSector = sectors.find(s => s.id === selectedSectorId);

        const newLog: OperationalLog = {
            id: `oplog-${Date.now()}`,
            organizationId: activeOrgId,
            workAssignmentId: finalAssignmentId,
            date: new Date(logDate).toISOString(),
            geometry,
            notes: notes.trim() || `Operational log (${areaM2.toLocaleString()} m², ${trenchRange || 'Trench'})`,
            areaHa,
            sectorId: selectedSectorId || undefined,
            sectorName: selectedSector?.name || undefined,
            trenchRange: trenchRange.trim() || undefined,
            trenchCount: Number(trenchCount) || 0,
            cropCount: Number(cropCount) || 0,
            measuredAreaM2: areaM2,
            measuredDistanceM: perimeterM,
            changeHistory: [{
                id: `audit-${Date.now()}`,
                timestamp: new Date().toISOString(),
                userName: currentUser?.name || 'Administrator',
                userEmail: currentUser?.email || '',
                action: 'Log Area Recorded',
                details: `Drawn area recorded: ${areaM2} m² (${areaHa.toFixed(4)} ha), Trench range: ${trenchRange || 'N/A'}`
            }]
        };

        onSaveLog(newLog, createdWork);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div 
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-2xl">
                            <MapPin size={22} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight uppercase flex items-center gap-2">
                                {isKa ? 'სამუშაო ფართობისა და ტრანშეის რეგისტრაცია' : 'Log Operational Area on Map'}
                            </h2>
                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">
                                {isKa ? 'მოხაზული კონტურის გაზომვა და დეტალების შენახვა' : 'Measure drawn boundary & record operational trench specs'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Live Area Measurements Pill Grid */}
                <div className="grid grid-cols-3 gap-2 p-4 bg-indigo-50/60 border-b border-indigo-100">
                    <div className="bg-white p-2.5 rounded-2xl border border-indigo-100 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                            <Ruler size={13} />
                            <span className="text-[9px] font-black uppercase tracking-wider">
                                {isKa ? 'ფართობი (მ²)' : 'Area (m²)'}
                            </span>
                        </div>
                        <span className="text-base font-black text-slate-800">
                            {areaM2.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">m²</span>
                        </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-indigo-100 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                            <Layers size={13} />
                            <span className="text-[9px] font-black uppercase tracking-wider">
                                {isKa ? 'ჰექტარი' : 'Hectares'}
                            </span>
                        </div>
                        <span className="text-base font-black text-slate-800">
                            {areaHa.toFixed(4)} <span className="text-[10px] text-slate-400 font-bold">ha</span>
                        </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-indigo-100 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                            <Compass size={13} />
                            <span className="text-[9px] font-black uppercase tracking-wider">
                                {isKa ? 'პერიმეტრი' : 'Perimeter'}
                            </span>
                        </div>
                        <span className="text-base font-black text-slate-800">
                            {perimeterM.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">m</span>
                        </span>
                    </div>
                </div>

                {/* Form Body */}
                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                    {/* Task Selection */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Briefcase size={12} className="text-indigo-500" />
                            {isKa ? 'დავალება / სამუშაო' : 'Linked Task / Work Mission'}
                        </label>
                        <select
                            value={selectedAssignmentId}
                            onChange={(e) => setSelectedAssignmentId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                        >
                            {workAssignments.map(w => (
                                <option key={w.id} value={w.id}>
                                    {typeof w.workName === 'string' ? w.workName : (w.workName as any)?.title || 'Task'} ({new Date(w.date).toLocaleDateString()} - {w.status})
                                </option>
                            ))}
                            <option value="new">
                                {isKa ? '+ ახალი დამოუკიდებელი საველე ოპერაცია' : '+ Create New Field Operation Mission'}
                            </option>
                        </select>
                    </div>

                    {selectedAssignmentId === 'new' && (
                        <div className="animate-in fade-in duration-150">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                                {isKa ? 'ახალი დავალების დასახელება' : 'New Task Mission Name'}
                            </label>
                            <input
                                type="text"
                                value={customTaskName}
                                onChange={(e) => setCustomTaskName(e.target.value)}
                                placeholder={isKa ? 'მაგ: ტრანშეის გაწმენდა, მარგვლა...' : 'e.g., Trench Weeding, Pruning...'}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    )}

                    {/* Sector and Date Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <Layers size={12} className="text-emerald-500" />
                                {isKa ? 'სექტორი / ნაკვეთი' : 'Sector / Field Zone'}
                            </label>
                            <select
                                value={selectedSectorId}
                                onChange={(e) => setSelectedSectorId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">{isKa ? '-- აირჩიეთ სექტორი --' : '-- Select Sector --'}</option>
                                {sectors.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name || s.id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <Calendar size={12} className="text-blue-500" />
                                {isKa ? 'თარიღი' : 'Execution Date'}
                            </label>
                            <input
                                type="date"
                                value={logDate}
                                onChange={(e) => setLogDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Trench Range & Detected Counts */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag size={12} className="text-indigo-500" />
                                {isKa ? 'ტრანშეების დიაპაზონი და რაოდენობა' : 'Trench Range & Specifications'}
                            </span>
                            {detectedInfo.trenchCount > 0 && (
                                <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    {isKa ? `აღმოჩენილია ${detectedInfo.trenchCount} მწკრივი` : `${detectedInfo.trenchCount} rows detected`}
                                </span>
                            )}
                        </div>

                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                {isKa ? 'ტრანშეების დიაპაზონი (ტექსტი / ნომრები)' : 'Range of the Trench (e.g. Row 1 - 25, A4 - B12)'}
                            </label>
                            <input
                                type="text"
                                value={trenchRange}
                                onChange={(e) => setTrenchRange(e.target.value)}
                                placeholder={isKa ? 'მაგ: მწკრივი 1 – 25, ტრანშეა A-დან G-მდე' : 'e.g. Trench Row 1 to 25'}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    {isKa ? 'ტრანშეების რაოდენობა' : 'Trench Count'}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={trenchCount}
                                    onChange={(e) => setTrenchCount(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    {isKa ? 'ნერგების / კულტურის რაოდენობა' : 'Crops / Seedlings Inside'}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={cropCount}
                                    onChange={(e) => setCropCount(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Operational Notes */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <FileText size={12} className="text-slate-500" />
                            {isKa ? 'შენიშვნები და სამუშაოს აღწერა' : 'Operational Notes & Field Feedback'}
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isKa ? 'შეიყვანეთ დეტალები შესრულებული სამუშაოს, ტექნიკის ან მუშაკების შესახებ...' : 'Add notes regarding trench condition, work quality, machinery, or staff...'}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>

                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <CheckCircle2 size={15} />
                        {isKa ? 'ფართობისა და ლოგის შენახვა' : 'Save Area & Record Log'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OperationalAreaLogModal;
