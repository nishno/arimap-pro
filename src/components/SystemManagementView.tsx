
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type { Employee, WorkAssignment, PlantationFeature, Machinery, Layer, OperationalLog, ActiveDrawingTool, Role, Permission, DailyLogEntry, NutritionPlan, InventoryItem, LinePlantationFeature, SeedlingPlantationFeature } from '../types';
import { isValidCoordinate } from '../types';
import SystemManagementPlanner from './SystemManagementPlanner';
import { MapComponent, MapComponentProps } from './MapComponent';
import { getSphericalPolygonArea } from '../services/geospatialService';
import { Popup } from 'react-leaflet';
import L from 'leaflet';
import { BriefcaseIcon, XIcon, CalendarDaysIcon, TractorIcon, ShieldCheckIcon, PlusIcon, RefreshCwIcon } from './Icons';
import '../lib/leafletSafety';
import { extractSafePoints } from '../lib/leafletSafety';

const parseSafeGeometry = (geom: any): [number, number][] => {
    return extractSafePoints(geom);
};

interface SystemManagementViewProps {
  systemProps: {
    employees: Employee[];
    onSetEmployees: (employees: Employee[]) => void;
    workAssignments: WorkAssignment[];
    onSetWorkAssignments: (assignments: WorkAssignment[]) => void;
    machinery: Machinery[];
    onSetMachinery: (machinery: Machinery[]) => void;
    plantationFeatures: PlantationFeature[];
    onSetHighlightedFeatureId: (id: string | null) => void;
    operationalLogs: OperationalLog[];
    onSetOperationalLogs: (logs: OperationalLog[] | ((prev: OperationalLog[]) => OperationalLog[])) => void;
    roles: Role[];
    onSetRoles: (roles: Role[]) => void;
    dailyLogs: DailyLogEntry[];
    onSetDailyLogs: (logs: DailyLogEntry[]) => void;
    currentUserPermissions: Set<Permission>;
    nutritionPlans: NutritionPlan[];
    inventoryItems: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    notes: any[];
    checkpoints: any[];
  };
  mapProps: MapComponentProps;
  onLogOnMapRequest: (type: 'work' | 'harvest', id: string) => void;
  onPushOfflineData?: () => Promise<void>;
  isManualOffline?: boolean;
}

const SystemManagementView: React.FC<SystemManagementViewProps> = (props) => {
    const { systemProps, mapProps, onPushOfflineData, isManualOffline } = props;
    const [isSyncing, setIsSyncing] = useState(false);
    const { center: mapCenter, zoom, plantationFeatures, layers } = mapProps;
    const [highlightedFeatureId, setHighlightedFeatureId] = useState<string | null>(null);
    const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeDrawingTool, setActiveDrawingTool] = useState<ActiveDrawingTool>({ tool: null, color: '#f97316', activeLayerId: 'log-layer' });
    const [loggingForAssignment, setLoggingForAssignment] = useState<WorkAssignment | null>(null);
    const [opLogPopup, setOpLogPopup] = useState<{ log: OperationalLog; latlng: L.LatLng; trenchCount: number; cropCount: number; } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleFeatureDrawn = (type: any, geometry: any) => {
        if (type === 'area' && loggingForAssignment) {
            const areaHa = getSphericalPolygonArea(geometry) / 10000;
            const newLog: OperationalLog = {
                id: `oplog-${Date.now()}`,
                workAssignmentId: loggingForAssignment.id,
                date: new Date(logDate).toISOString(),
                geometry,
                notes: `Log for ${loggingForAssignment.workName} (${(areaHa * 10000).toFixed(0)} m²)`,
                areaHa,
            };
            systemProps.onSetOperationalLogs(prev => [...prev, newLog]);
            setLoggingForAssignment(null);
            setActiveDrawingTool({ tool: null });
        }
    };
    
    const handleLogOnMapRequest = (assignment: WorkAssignment) => {
        setLoggingForAssignment(assignment);
        setActiveDrawingTool({ tool: 'area', color: '#3b82f6', activeLayerId: 'operational-logs' });
    };
    
    const handleOpLogClick = (log: OperationalLog, latlng: L.LatLng) => {
        if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
        const validLogGeom = parseSafeGeometry(log.geometry);
        if (validLogGeom.length < 3) return;
        try {
            // High-performance Axis-Aligned Bounding Box calculation
            let logMinLat = Infinity, logMaxLat = -Infinity;
            let logMinLng = Infinity, logMaxLng = -Infinity;
            for (const p of validLogGeom) {
                if (p[0] < logMinLat) logMinLat = p[0];
                if (p[0] > logMaxLat) logMaxLat = p[0];
                if (p[1] < logMinLng) logMinLng = p[1];
                if (p[1] > logMaxLng) logMaxLng = p[1];
            }
        
            const trenchesInLog = plantationFeatures.filter(f => {
                if (f.type !== 'line' || (f as LinePlantationFeature).lineType !== 'row') return false;
                const geom = (f as LinePlantationFeature).geometry;
                if (!geom) return false;
                const validTrenchGeom = parseSafeGeometry(geom);
                if (validTrenchGeom.length < 1) return false;
                return validTrenchGeom.some((point: [number, number]) => {
                    const lat = point[0];
                    const lng = point[1];
                    // Check if point is inside Axis-Aligned Bounding Box (identical to logBounds.contains)
                    return lat >= logMinLat && lat <= logMaxLat && lng >= logMinLng && lng <= logMaxLng;
                });
            }) as LinePlantationFeature[];
        
            const trenchIds = new Set(trenchesInLog.map(t => t.id));
            const cropsInLog = plantationFeatures.filter(f => 
                f.type === 'seedling' && f.parentId && trenchIds.has(f.parentId)
            ).length;
        
            setOpLogPopup({ log, latlng, trenchCount: trenchesInLog.length, cropCount: cropsInLog });
        } catch (e) {
            console.error("Failed to compute operational log details on click:", e);
        }
    };


    const workAssignmentForLog = opLogPopup ? systemProps.workAssignments.find(w => w.id === opLogPopup.log.workAssignmentId) : null;

    return (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden h-full bg-[#f8fafc] relative">
            {/* Sidebar Toggle (Mobile) */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden absolute top-4 right-4 z-[1005] p-3 bg-white border border-slate-200 rounded-2xl shadow-xl text-[#3b36db]"
            >
                {isSidebarOpen ? <XIcon size={20} /> : <BriefcaseIcon size={20} />}
            </button>

            {/* Sidebar */}
            {isSidebarOpen && (
                <div className="fixed inset-0 md:relative md:inset-auto z-[1004] md:z-[1001] w-full md:w-[400px] lg:w-[450px] flex-shrink-0 border-r overflow-hidden flex flex-col bg-white">
                    <div className="p-6 border-b bg-white flex-shrink-0">
                        <div className="flex flex-col mb-6">
                            <h1 className="text-2xl font-black italic text-[#3b36db] tracking-tighter flex items-center gap-2">
                                FIELD <span className="text-[#3b36db]">COMMAND</span>
                            </h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                                Personnel and Fleet Orchestration Terminal
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#f8fafc] p-4 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Staff Health</p>
                                <p className="text-xl font-black text-slate-800 italic">NOMINAL</p>
                            </div>
                            <div className="bg-[#f8fafc] p-4 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Status</p>
                                <p className="text-xl font-black text-slate-800 italic">
                                    {systemProps.machinery.filter(m => m.status === 'operational').length}/{systemProps.machinery.length} OK
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] p-6 mb-6 shadow-xl shadow-slate-200">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <ShieldCheckIcon size={14} className="text-emerald-500" /> System & Backup
                            </h3>
                            <div className="space-y-3">
                                <button 
                                    disabled={isSyncing || isManualOffline}
                                    onClick={async () => {
                                        setIsSyncing(true);
                                        await onPushOfflineData?.();
                                        setIsSyncing(false);
                                    }}
                                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 ${isManualOffline ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-900/20'}`}
                                >
                                    {isSyncing ? <RefreshCwIcon size={16} className="animate-spin" /> : <PlusIcon size={16} className="rotate-45" />}
                                    Push to Firestore
                                </button>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-center">
                                    {isManualOffline ? 'Switch to Online Mode to sync data' : 'Manually trigger cloud synchronization'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <SystemManagementPlanner 
                        {...systemProps} 
                        onSetHighlightedFeatureId={setHighlightedFeatureId} 
                        onLogOnMapRequest={handleLogOnMapRequest} 
                    />
                </div>
            )}
            
            {/* Map Area */}
            <div className="flex-1 flex flex-col relative w-full overflow-hidden">
                {/* Top Controls */}
                <div className="absolute top-4 md:top-6 left-4 md:left-6 right-4 md:right-6 z-[1000] flex items-center justify-start pointer-events-none">
                    <div className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 bg-white border border-slate-200 rounded-2xl shadow-xl pointer-events-auto">
                        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-white rounded-xl">
                            <CalendarDaysIcon className="h-4 w-4 md:h-5 md:w-5 text-[#3b36db]" />
                            <input 
                                type="date" 
                                value={logDate} 
                                onChange={e => setLogDate(e.target.value)} 
                                className="font-black text-slate-800 outline-none text-xs md:text-sm bg-transparent"
                            />
                        </div>
                        <button className="p-2 md:p-3 bg-[#10b981] text-white rounded-xl hover:bg-[#059669] transition-colors">
                            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Overlays */}
                <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white shadow-xl flex items-center gap-3 pointer-events-auto">
                        <div className="flex -space-x-2">
                            <div className="h-6 w-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center">
                                <BriefcaseIcon className="h-3 w-3 text-blue-600" />
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Workforce Overlay: Active</span>
                    </div>
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white shadow-xl flex items-center gap-3 pointer-events-auto">
                        <div className="h-6 w-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center">
                            <TractorIcon className="h-3 w-3 text-orange-600" />
                        </div>
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Machinery Overlay: Active</span>
                    </div>
                </div>

                <div className="flex-1 relative">
                     <MapComponent 
                        {...mapProps}
                        showSearch={false}
                        onSelectFeature={() => {}}
                        highlightedFeatureIds={highlightedFeatureId ? [highlightedFeatureId] : []}
                        activeDrawingTool={activeDrawingTool}
                        onFeatureDrawn={handleFeatureDrawn}
                        onSetActiveDrawingTool={setActiveDrawingTool}
                        operationalLogs={systemProps.operationalLogs}
                        onOperationalLogClick={handleOpLogClick}
                    >
                        {opLogPopup && (
                            <Popup position={opLogPopup.latlng} eventHandlers={{ remove: () => setOpLogPopup(null) }} className="harvest-log-popup">
                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><BriefcaseIcon className="h-4 w-4 text-blue-500" /> Work Log Detail</h3>
                                        <button onClick={() => setOpLogPopup(null)} className="p-1 rounded-full hover:bg-slate-100"><XIcon className="h-3 w-3"/></button>
                                    </div>
                                    <div className="text-[11px] space-y-2">
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Task:</span> <span className="font-bold text-slate-800 truncate">{workAssignmentForLog?.workName || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Date:</span> <span className="font-bold text-slate-800">{new Date(opLogPopup.log.date).toLocaleDateString()}</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Area:</span> <span className="font-bold text-slate-800">{opLogPopup.log.areaHa?.toFixed(4)} ha</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Trenches:</span> <span className="font-bold text-slate-800">{opLogPopup.trenchCount}</span></div>
                                        <div className="flex justify-between"><span className="font-bold text-slate-400 uppercase">Crops:</span> <span className="font-bold text-slate-800">{opLogPopup.cropCount}</span></div>
                                        
                                        <button 
                                            id="delete-work-log-btn-sys"
                                            onClick={() => {
                                                if (window.confirm("Are you sure you want to delete this operational log?")) {
                                                    systemProps.onSetOperationalLogs(prev => prev.filter(l => l.id !== opLogPopup.log.id));
                                                    setOpLogPopup(null);
                                                    toast.success("Operational log deleted successfully.");
                                                }
                                            }}
                                            className="w-full mt-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                        >
                                            Delete Log
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        )}
                    </MapComponent>
                </div>
            </div>
        </main>
    );
};

export default SystemManagementView;
