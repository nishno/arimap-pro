import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Camera, User, Navigation, Droplets, Mountain, X, Loader2, Sparkles } from 'lucide-react';
import type { PlantationFeature } from '../../../types';
import type { PlantationCamera } from './CameraNvrLab';
import type { SandboxSoilSensor, SandboxWaterSensor, SandboxWorkerGps, SandboxDroneMission } from './HardwareTestingSandboxMap';
import type { HillSpineProfile } from '../../../utils/demTerrainViewshed';

interface SearchResultItem {
    id: string;
    title: string;
    subtitle: string;
    type: 'camera' | 'worker' | 'drone' | 'sensor' | 'slope' | 'sector' | 'place';
    lat: number;
    lng: number;
    zoom?: number;
    raw?: any;
}

interface SandboxLocationSearchBarProps {
    testCameras: PlantationCamera[];
    testWorkersGps: SandboxWorkerGps[];
    testDroneMission: SandboxDroneMission;
    testSoilSensors: SandboxSoilSensor[];
    testWaterSensors: SandboxWaterSensor[];
    hillSpineProfile: HillSpineProfile;
    plantationFeatures?: PlantationFeature[];
    onSelectLocation: (lat: number, lng: number, zoom?: number, item?: any) => void;
    isKa?: boolean;
}

export const SandboxLocationSearchBar: React.FC<SandboxLocationSearchBarProps> = ({
    testCameras,
    testWorkersGps,
    testDroneMission,
    testSoilSensors,
    testWaterSensors,
    hillSpineProfile,
    plantationFeatures = [],
    onSelectLocation,
    isKa = false
}) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isSearchingExternal, setIsSearchingExternal] = useState(false);
    const [externalResults, setExternalResults] = useState<SearchResultItem[]>([]);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, []);

    // Filter local devices & features
    const localResults: SearchResultItem[] = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const res: SearchResultItem[] = [];

        // Cameras
        testCameras.forEach(c => {
            if (c.name.toLowerCase().includes(q) || `ch${c.channel}`.includes(q) || (c.locationName && c.locationName.toLowerCase().includes(q))) {
                res.push({
                    id: `cam-${c.id}`,
                    title: `📹 [CH0${c.channel}] ${c.name}`,
                    subtitle: c.locationName || `Azimuth: ${c.azimuthDeg}°, Range: ${c.rangeM}m`,
                    type: 'camera',
                    lat: c.lat,
                    lng: c.lng,
                    zoom: 19,
                    raw: { type: 'camera', data: c }
                });
            }
        });

        // Workers
        testWorkersGps.forEach(w => {
            if (w.workerName.toLowerCase().includes(q) || (w.role && w.role.toLowerCase().includes(q))) {
                res.push({
                    id: `wrk-${w.id}`,
                    title: `👷 ${w.workerName}`,
                    subtitle: `Role: ${w.role} • Battery: ${w.batteryPct}%`,
                    type: 'worker',
                    lat: w.lat,
                    lng: w.lng,
                    zoom: 19,
                    raw: { type: 'worker', data: w }
                });
            }
        });

        // Drone
        if ('drone'.includes(q) || 'uav'.includes(q) || (testDroneMission.name && testDroneMission.name.toLowerCase().includes(q))) {
            res.push({
                id: 'drone-loc',
                title: '🛸 Drone Mission & Telemetry',
                subtitle: `Mode: ${testDroneMission.mode} • Alt: ${testDroneMission.currentAlt}m • Bat: ${testDroneMission.batteryPct}%`,
                type: 'drone',
                lat: testDroneMission.currentLat,
                lng: testDroneMission.currentLng,
                zoom: 18,
                raw: { type: 'drone', data: testDroneMission }
            });
        }

        // Soil Sensors
        testSoilSensors.forEach(s => {
            if (s.name.toLowerCase().includes(q) || 'soil'.includes(q)) {
                res.push({
                    id: `soil-${s.id}`,
                    title: `🌱 ${s.name}`,
                    subtitle: `Moisture: ${s.moistureVwc}% • Depth: ${s.depthCm}cm`,
                    type: 'sensor',
                    lat: s.lat,
                    lng: s.lng,
                    zoom: 19,
                    raw: { type: 'soil', data: s }
                });
            }
        });

        // Water Sensors
        testWaterSensors.forEach(w => {
            if (w.name.toLowerCase().includes(q) || 'water'.includes(q)) {
                res.push({
                    id: `water-${w.id}`,
                    title: `💧 ${w.name}`,
                    subtitle: `Flow: ${w.flowRateLpm} L/min • Pressure: ${w.pressureBar} bar`,
                    type: 'sensor',
                    lat: w.lat,
                    lng: w.lng,
                    zoom: 19,
                    raw: { type: 'water', data: w }
                });
            }
        });

        // Slope Points
        hillSpineProfile.points.forEach((p, idx) => {
            const letter = String.fromCharCode(65 + idx);
            if (p.name.toLowerCase().includes(q) || letter.toLowerCase() === q || 'slope'.includes(q) || 'mound'.includes(q)) {
                res.push({
                    id: `pt-${p.id}`,
                    title: `🏔️ ${p.name} (Point ${letter})`,
                    subtitle: `Peak Height: ${p.peakHeightM}m • Width: ${p.widthM}m`,
                    type: 'slope',
                    lat: p.lat,
                    lng: p.lng,
                    zoom: 19,
                    raw: { type: 'slope_point', data: p }
                });
            }
        });

        // Plantation Features / Sectors
        plantationFeatures.forEach(f => {
            if (f.name && f.name.toLowerCase().includes(q)) {
                let lat = 0, lng = 0;
                if ((f as any).coordinates && (f as any).coordinates.length > 0) {
                    const first = (f as any).coordinates[0];
                    lat = Array.isArray(first) ? first[0] : first?.lat;
                    lng = Array.isArray(first) ? first[1] : first?.lng;
                } else if ((f as any).location) {
                    const loc = (f as any).location;
                    lat = Array.isArray(loc) ? loc[0] : loc?.lat;
                    lng = Array.isArray(loc) ? loc[1] : loc?.lng;
                }
                if (lat && lng) {
                    res.push({
                        id: `feat-${f.id}`,
                        title: `📍 ${f.name}`,
                        subtitle: `Plantation feature • Type: ${f.type}`,
                        type: 'sector',
                        lat,
                        lng,
                        zoom: 18,
                        raw: { type: 'feature', data: f }
                    });
                }
            }
        });

        return res;
    }, [query, testCameras, testWorkersGps, testDroneMission, testSoilSensors, testWaterSensors, hillSpineProfile, plantationFeatures]);

    // External search with debounce
    useEffect(() => {
        const q = query.trim();
        if (q.length < 3) {
            setExternalResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingExternal(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=4`);
                if (res.ok) {
                    const data = await res.json();
                    const mapped: SearchResultItem[] = data.map((d: any) => ({
                        id: `ext-${d.place_id}`,
                        title: d.display_name.split(',')[0],
                        subtitle: d.display_name,
                        type: 'place',
                        lat: parseFloat(d.lat),
                        lng: parseFloat(d.lon),
                        zoom: 15
                    }));
                    setExternalResults(mapped);
                }
            } catch (e) {
                // Ignore network glitch
            } finally {
                setIsSearchingExternal(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const allResults = [...localResults, ...externalResults];

    return (
        <div ref={containerRef} className="relative z-[1250]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-lg backdrop-blur-md focus-within:ring-2 focus-within:ring-blue-500 transition-all w-48 sm:w-64">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={isKa ? 'ძიება: კამერა, მუშა, ქალაქი...' : 'Search device, sector, place...'}
                    className="bg-transparent text-white text-xs outline-none w-full placeholder:text-slate-500 font-medium"
                />
                {isSearchingExternal && <Loader2 size={13} className="text-blue-400 animate-spin shrink-0" />}
                {query && !isSearchingExternal && (
                    <button
                        onClick={() => {
                            setQuery('');
                            setIsOpen(false);
                        }}
                        className="text-slate-400 hover:text-white cursor-pointer"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && query.trim().length > 0 && (
                <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 max-h-72 overflow-y-auto bg-slate-950/98 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-2xl p-1.5 space-y-1 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    {allResults.length === 0 && !isSearchingExternal && (
                        <div className="p-3 text-center text-xs text-slate-400">
                            {isKa ? 'შედეგი ვერ მოიძებნა' : 'No devices or locations found'}
                        </div>
                    )}

                    {localResults.length > 0 && (
                        <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                            {isKa ? 'მოწყობილობები & პლანტაცია' : 'Devices & Plantation'}
                        </div>
                    )}
                    {localResults.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onSelectLocation(item.lat, item.lng, item.zoom || 18, item.raw);
                                setIsOpen(false);
                            }}
                            className="w-full p-2 rounded-xl text-left hover:bg-blue-600/30 border border-transparent hover:border-blue-500/50 transition-all flex items-start gap-2.5 cursor-pointer group"
                        >
                            <div className="mt-0.5 shrink-0 text-blue-400 group-hover:scale-110 transition-transform">
                                {item.type === 'camera' && <Camera size={14} />}
                                {item.type === 'worker' && <User size={14} />}
                                {item.type === 'drone' && <Navigation size={14} />}
                                {item.type === 'sensor' && <Droplets size={14} />}
                                {item.type === 'slope' && <Mountain size={14} />}
                                {item.type === 'sector' && <MapPin size={14} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">{item.title}</div>
                                <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                            </div>
                        </button>
                    ))}

                    {externalResults.length > 0 && (
                        <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 mt-2">
                            {isKa ? 'გლობალური ლოკაციები (OpenStreetMap)' : 'Global Places (OpenStreetMap)'}
                        </div>
                    )}
                    {externalResults.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onSelectLocation(item.lat, item.lng, item.zoom || 15);
                                setIsOpen(false);
                            }}
                            className="w-full p-2 rounded-xl text-left hover:bg-cyan-600/30 border border-transparent hover:border-cyan-500/50 transition-all flex items-start gap-2.5 cursor-pointer group"
                        >
                            <MapPin size={14} className="mt-0.5 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">{item.title}</div>
                                <div className="text-[10px] text-slate-400 line-clamp-1">{item.subtitle}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
