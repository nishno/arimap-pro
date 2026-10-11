import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Navigation, Play, Pause, RotateCcw, Trash2, Eye, EyeOff, 
    Compass, Clock, Battery, AlertCircle, Check, ArrowRight,
    MapPin, Sliders, ChevronDown, ChevronUp, Save, Plane, 
    Crosshair, ShieldCheck, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { safeStorage } from '../services/storageService';
import type { PlantationFeature } from '../types';

export interface DroneFlightWaypoint {
    id: string;
    lat: number;
    lng: number;
    altitudeM: number;
    speedMs: number;
    leg: 'takeoff' | 'outbound' | 'sector_orbit' | 'return' | 'landing';
    name?: string;
}

export interface DroneFlightMission {
    id: string;
    name: string;
    mode: 'waypoints' | 'circle_sector';
    waypoints: DroneFlightWaypoint[];
    altitudeM: number;
    speedMs: number;
    timeIntervalSec: number;
    headingDeg: number;
    circleCenter?: [number, number];
    circleRadiusM?: number;
    sectorId?: string;
    isHidden: boolean; // For de-cluttering: hide/restore toggle
}

interface DroneFlightPathPlannerProps {
    isOpen: boolean;
    onClose: () => void;
    mission: DroneFlightMission;
    onChangeMission: (updated: DroneFlightMission | null) => void;
    plantationFeatures?: PlantationFeature[];
    onStartSimulation?: (mission: DroneFlightMission) => void;
    activeDrawingTool?: any;
    onSetActiveDrawingTool?: (tool: any) => void;
}

export const DroneFlightPathPlanner: React.FC<DroneFlightPathPlannerProps> = ({
    isOpen,
    onClose,
    mission,
    onChangeMission,
    plantationFeatures = [],
    onStartSimulation,
    onSetActiveDrawingTool
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [activeLeg, setActiveLeg] = useState<'outbound' | 'return' | 'circle'>('outbound');
    const [isAddingWaypointMode, setIsAddingWaypointMode] = useState<boolean>(false);

    // Filter available plantation sectors for circling
    const sectors = useMemo(() => {
        return plantationFeatures.filter(f => f.type === 'area' || f.type === 'sector' || f.type === 'boundary');
    }, [plantationFeatures]);

    // Calculate total distance of waypoints
    const totalDistanceMeters = useMemo(() => {
        if (mission.mode === 'circle_sector') {
            const r = mission.circleRadiusM || 60;
            return Math.round(2 * Math.PI * r);
        }
        if (mission.waypoints.length < 2) return 0;
        let dist = 0;
        for (let i = 0; i < mission.waypoints.length - 1; i++) {
            const p1 = mission.waypoints[i];
            const p2 = mission.waypoints[i + 1];
            const dLat = (p2.lat - p1.lat) * 111111;
            const dLng = (p2.lng - p1.lng) * 111111 * Math.cos((p1.lat * Math.PI) / 180);
            dist += Math.sqrt(dLat * dLat + dLng * dLng);
        }
        return Math.round(dist);
    }, [mission]);

    // Calculate flight duration in minutes & seconds
    const flightDurationSec = useMemo(() => {
        const speed = Math.max(1, mission.speedMs || 10);
        return Math.round(totalDistanceMeters / speed);
    }, [totalDistanceMeters, mission.speedMs]);

    // Estimated battery drain
    const estimatedBatteryPct = useMemo(() => {
        // e.g. 15 minutes = ~50% battery
        return Math.min(100, Math.max(5, Math.round((flightDurationSec / 1200) * 100)));
    }, [flightDurationSec]);

    if (!isOpen) return null;

    // Toggle temporary hide / restore to avoid cluttering the map!
    const handleToggleHideRestore = () => {
        const nextHidden = !mission.isHidden;
        onChangeMission({
            ...mission,
            isHidden: nextHidden
        });
        toast.info(nextHidden 
            ? (isKa ? "დრონის მარშრუტი დროებით დამალულია რუკიდან" : "Drone flight path temporarily hidden from map") 
            : (isKa ? "დრონის მარშრუტი აღდგენილია რუკაზე" : "Drone flight path restored on map")
        );
    };

    // Permanently delete or clear elements
    const handleDeleteMission = () => {
        onChangeMission(null);
        toast.success(isKa ? "დრონის ფრენის მარშრუტი წაშლილია რუკიდან" : "Drone flight path cleared from map");
        onClose();
    };

    // Preset return leg (RTH back to takeoff waypoint)
    const handlePreSetReturnLeg = () => {
        if (mission.waypoints.length < 2) {
            toast.warning(isKa ? "ჯერ დაამატეთ გამავალი წერტილები" : "Add outbound waypoints first");
            return;
        }
        const homeWp = mission.waypoints[0];
        const returnWp: DroneFlightWaypoint = {
            id: `wp-return-${Date.now()}`,
            lat: homeWp.lat,
            lng: homeWp.lng,
            altitudeM: mission.altitudeM,
            speedMs: mission.speedMs,
            leg: 'return',
            name: isKa ? 'დაბრუნება ბაზაზე (RTH)' : 'Return to Base (RTH)'
        };

        onChangeMission({
            ...mission,
            waypoints: [...mission.waypoints, returnWp]
        });
        toast.success(isKa ? "დაბრუნების მარშრუტი (RTH) დამატებულია!" : "Return leg (RTH) connected!");
    };

    return (
        <div className="fixed top-20 right-4 sm:right-6 z-[2200] w-[320px] sm:w-[380px] bg-slate-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200 text-white select-none">
            
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-cyan-600/20 border border-cyan-500/40 rounded-xl text-cyan-400">
                        <Plane size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                                UAV Flight Controller
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-md font-mono text-[9px] ${
                                mission.isHidden ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}>
                                {mission.isHidden ? (isKa ? 'დამალული' : 'HIDDEN') : (isKa ? 'ხილვადი' : 'ACTIVE')}
                            </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-black uppercase text-white truncate max-w-[180px]">
                            {isKa ? 'დრონის ფრენის გეგმა' : 'Real-time Drone Mission'}
                        </h4>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Hide / Restore Toggle to Prevent Cluttering! */}
                    <button
                        type="button"
                        onClick={handleToggleHideRestore}
                        className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                            mission.isHidden 
                                ? 'bg-amber-600/20 border-amber-500/40 text-amber-300 hover:bg-amber-600/30' 
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                        title={mission.isHidden ? "Restore flight path on map" : "Temporarily hide flight path to unclutter map"}
                    >
                        {mission.isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>

                    {/* Delete / Clear Button */}
                    <button
                        type="button"
                        onClick={handleDeleteMission}
                        className="p-1.5 bg-slate-800 hover:bg-red-950 hover:text-red-400 border border-slate-700 rounded-xl text-slate-400 transition-colors cursor-pointer"
                        title={isKa ? "მარშრუტის წაშლა" : "Delete flight path"}
                    >
                        <Trash2 size={15} />
                    </button>

                    {/* Minimize / Expand */}
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        {isMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Collapsed view summary */}
            {isMinimized && (
                <div className="p-3 bg-slate-950 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">{mission.waypoints.length} WPs • {totalDistanceMeters}m</span>
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="text-cyan-400 font-bold hover:underline"
                    >
                        {isKa ? 'გახსნა' : 'Expand'}
                    </button>
                </div>
            )}

            {/* Expanded Planner Controls */}
            {!isMinimized && (
                <div className="p-4 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
                    
                    {/* Mission Mode Switcher: Waypoints vs Circle Sector */}
                    <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            onClick={() => onChangeMission({ ...mission, mode: 'waypoints' })}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                mission.mode === 'waypoints' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isKa ? 'წერტილები (სავალი/დაბრუნება)' : 'Waypoints (Out/Return)'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeMission({ ...mission, mode: 'circle_sector' })}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                mission.mode === 'circle_sector' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isKa ? 'სექტორის წრეზე შემოვლა' : 'Circle Sector Orbit'}
                        </button>
                    </div>

                    {/* Mode 1: Outbound & Return Leg Options */}
                    {mission.mode === 'waypoints' && (
                        <div className="space-y-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="font-black uppercase text-[10px] text-slate-400">
                                    {isKa ? 'მარშრუტის წერტილები' : 'Waypoints Sequence'} ({mission.waypoints.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={handlePreSetReturnLeg}
                                    className="px-2 py-0.5 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-700/60 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                                >
                                    + {isKa ? 'დაბრუნება ბაზაზე' : 'Preset Return Leg'}
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-400 leading-relaxed">
                                {isKa 
                                    ? 'დააწკაპუნეთ რუკაზე ახალი წერტილების (WP) დასამატებლად გამავალი და დაბრუნების ტრაექტორიისთვის.' 
                                    : 'Click directly on the real map to place waypoints for outbound and return legs.'
                                }
                            </p>

                            {/* Waypoint list preview */}
                            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                {mission.waypoints.map((wp, idx) => (
                                    <div 
                                        key={wp.id} 
                                        className="flex items-center justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px] font-mono"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-slate-950 ${
                                                wp.leg === 'takeoff' ? 'bg-emerald-400' : wp.leg === 'return' ? 'bg-amber-400' : 'bg-cyan-400'
                                            }`}>
                                                {idx === 0 ? 'H' : idx}
                                            </span>
                                            <span className="text-slate-300 font-bold">
                                                {wp.leg === 'takeoff' ? 'Home Station' : wp.leg === 'return' ? 'Return Leg' : `WP-${idx}`}
                                            </span>
                                        </div>
                                        <span className="text-slate-400">
                                            {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mode 2: Circle Sector Orbit Settings */}
                    {mission.mode === 'circle_sector' && (
                        <div className="space-y-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
                            <span className="font-black uppercase text-[10px] text-slate-400 block">
                                {isKa ? 'სექტორის არჩევა ან რადიუსი' : 'Sector Orbit Surveillance'}
                            </span>
                            
                            {sectors.length > 0 && (
                                <div>
                                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                        {isKa ? 'პლანტაციის სექტორი' : 'Plantation Sector to Circle'}
                                    </label>
                                    <select
                                        value={mission.sectorId || ''}
                                        onChange={(e) => {
                                            const sec = sectors.find(s => s.id === e.target.value);
                                            const coords = (sec?.geometry?.[0] as [number, number]) || [41.9023, 44.5];
                                            onChangeMission({
                                                ...mission,
                                                sectorId: e.target.value,
                                                circleCenter: coords
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white outline-none"
                                    >
                                        <option value="">{isKa ? '-- აირჩიეთ სექტორი --' : '-- Select Sector --'}</option>
                                        {sectors.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                        {isKa ? 'წრიული პატრულირების რადიუსი' : 'Orbit Circle Radius'}
                                    </span>
                                    <span className="font-mono font-bold text-cyan-400">
                                        {mission.circleRadiusM || 60} m
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="250"
                                    value={mission.circleRadiusM || 60}
                                    onChange={(e) => onChangeMission({ ...mission, circleRadiusM: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Direct Flight Parameter Controls: Altitude, Speed, Time Intervals, Direction */}
                    <div className="space-y-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
                        <span className="font-black uppercase text-[10px] text-cyan-400 block tracking-wider">
                            {isKa ? 'ფრენის პარამეტრები რუკაზე' : 'Mission Parameters'}
                        </span>

                        {/* Altitude */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-black uppercase text-slate-400">
                                    {isKa ? 'ფრენის სიმაღლე (Altitude)' : 'Flight Altitude (AGL)'}
                                </span>
                                <span className="font-mono font-bold text-emerald-400">
                                    {mission.altitudeM} m
                                </span>
                            </div>
                            <input
                                type="range"
                                min="15"
                                max="150"
                                value={mission.altitudeM}
                                onChange={(e) => onChangeMission({ ...mission, altitudeM: Number(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>

                        {/* Speed */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-black uppercase text-slate-400">
                                    {isKa ? 'ფრენის სიჩქარე (Speed)' : 'Flight Speed'}
                                </span>
                                <span className="font-mono font-bold text-blue-400">
                                    {mission.speedMs} m/s ({Math.round(mission.speedMs * 3.6)} km/h)
                                </span>
                            </div>
                            <input
                                type="range"
                                min="3"
                                max="25"
                                value={mission.speedMs}
                                onChange={(e) => onChangeMission({ ...mission, speedMs: Number(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>

                        {/* Time Intervals & Direction */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                    {isKa ? 'ინტერვალი (Interval)' : 'Time Interval'}
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={mission.timeIntervalSec}
                                        onChange={(e) => onChangeMission({ ...mission, timeIntervalSec: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl font-bold font-mono text-center text-white"
                                    />
                                    <span className="text-slate-400 font-mono text-[10px]">sec</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                    {isKa ? 'მიმართულება (Heading)' : 'Direction / Heading'}
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="0"
                                        max="359"
                                        value={mission.headingDeg}
                                        onChange={(e) => onChangeMission({ ...mission, headingDeg: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl font-bold font-mono text-center text-white"
                                    />
                                    <span className="text-slate-400 font-mono text-[10px]">°</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mission Telemetry HUD Cards */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-950 rounded-2xl border border-slate-800 text-center font-mono">
                        <div>
                            <span className="text-[8px] uppercase text-slate-400 block">{isKa ? 'მანძილი' : 'Distance'}</span>
                            <span className="text-xs font-black text-white">{totalDistanceMeters}m</span>
                        </div>
                        <div className="border-x border-slate-800">
                            <span className="text-[8px] uppercase text-slate-400 block">{isKa ? 'დრო' : 'Duration'}</span>
                            <span className="text-xs font-black text-cyan-400">{Math.floor(flightDurationSec / 60)}m {flightDurationSec % 60}s</span>
                        </div>
                        <div>
                            <span className="text-[8px] uppercase text-slate-400 block">{isKa ? 'ბატარეა' : 'Battery'}</span>
                            <span className="text-xs font-black text-emerald-400">~{estimatedBatteryPct}%</span>
                        </div>
                    </div>

                    {/* Action Buttons: Launch Simulation & Save Mission */}
                    <div className="space-y-2 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                if (onStartSimulation) {
                                    onStartSimulation(mission);
                                }
                                toast.success(isKa ? "დრონის ფრენის სიმულაცია გაეშვა!" : "Drone flight mission simulation started!");
                            }}
                            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-cyan-900/40 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                            <Play size={14} fill="currentColor" />
                            <span>{isKa ? 'სიმულაციის გაშვება რუკაზე' : 'Launch Simulation on Map'}</span>
                        </button>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleToggleHideRestore}
                                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {mission.isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                <span>{mission.isHidden ? (isKa ? 'გამოჩენა' : 'Restore') : (isKa ? 'დროებით დამალვა' : 'Hide from Map')}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleDeleteMission}
                                className="px-3 py-2 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Trash2 size={13} />
                                <span>{isKa ? 'წაშლა' : 'Clear'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
