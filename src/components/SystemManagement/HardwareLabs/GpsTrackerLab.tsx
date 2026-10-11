import React, { useState, useEffect, useRef } from 'react';
import { 
    Navigation, Play, Pause, RotateCcw, MapPin, Radio, Shield, 
    Truck, User, Activity, AlertTriangle, CheckCircle, Wifi, Settings, 
    ExternalLink, Plus, Trash2, Battery, Gauge, Compass 
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../../../services/storageService';
import { Employee } from '../../../types';
import { getMainPlantation, getPlantationsList } from '../../../utils/plantationHelper';

export interface GpsDevice {
    id: string;
    name: string;
    type: 'worker_jacket' | 'vehicle_tractor' | 'vehicle_truck' | 'foreman_badge';
    assignedTo?: string; // Employee name or vehicle code
    protocol: 'TELTONIKA_GH5200' | 'TELTONIKA_FMB920' | 'TRACCAR_OSMAND' | 'MQTT' | 'NMEA_0183' | 'WEBHOOK';
    imei: string;
    status: 'ONLINE' | 'STANDBY' | 'GEOFENCE_ALERT' | 'OFFLINE';
    batteryPct: number;
    speedKmh: number;
    headingDeg: number;
    lat: number;
    lng: number;
    altitudeM: number;
    accuracyM: number;
    lastPingTime: string;
    rowAssignment?: string;
    history: [number, number][];
}

interface GpsTrackerLabProps {
    employees?: Employee[];
    activeOrgId?: string;
    mapCenter?: [number, number];
    onSyncWithMapFeatures?: (devices: GpsDevice[]) => void;
}

export const GpsTrackerLab: React.FC<GpsTrackerLabProps> = ({
    employees = [],
    activeOrgId,
    mapCenter = [41.9023, 44.5],
    onSyncWithMapFeatures
}) => {
    // Center baseline coordinates
    const baseLat = mapCenter[0] || 41.9023;
    const baseLng = mapCenter[1] || 44.5;

    const mainPlantation = getMainPlantation([], [baseLat, baseLng], activeOrgId);
    const plantationList = getPlantationsList([], [baseLat, baseLng], false, activeOrgId);
    const [selectedPlantationName, setSelectedPlantationName] = useState(mainPlantation.name);

    // GPS Device Fleet
    const [devices, setDevices] = useState<GpsDevice[]>(() => {
        const saved = safeStorage.getItem('agrimap_gps_devices');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [
            {
                id: 'gps-jacket-01',
                name: 'Worker Smart Jacket #1 (Giorgi)',
                type: 'worker_jacket',
                assignedTo: 'Giorgi N. (Picker)',
                protocol: 'TELTONIKA_GH5200',
                imei: '864729048192001',
                status: 'ONLINE',
                batteryPct: 92,
                speedKmh: 2.8,
                headingDeg: 85,
                lat: baseLat + 0.0012,
                lng: baseLng + 0.0008,
                altitudeM: 142,
                accuracyM: 1.2,
                lastPingTime: 'Just now',
                rowAssignment: 'Blueberry Block A - Row 4',
                history: [
                    [baseLat + 0.0010, baseLng + 0.0004],
                    [baseLat + 0.0011, baseLng + 0.0006],
                    [baseLat + 0.0012, baseLng + 0.0008]
                ]
            },
            {
                id: 'gps-jacket-02',
                name: 'Worker Smart Jacket #2 (Ana)',
                type: 'worker_jacket',
                assignedTo: 'Ana K. (Harvest Lead)',
                protocol: 'TELTONIKA_GH5200',
                imei: '864729048192002',
                status: 'ONLINE',
                batteryPct: 78,
                speedKmh: 1.9,
                headingDeg: 120,
                lat: baseLat + 0.0015,
                lng: baseLng + 0.0014,
                altitudeM: 144,
                accuracyM: 1.4,
                lastPingTime: '10s ago',
                rowAssignment: 'Blueberry Block A - Row 6',
                history: [
                    [baseLat + 0.0013, baseLng + 0.0011],
                    [baseLat + 0.0015, baseLng + 0.0014]
                ]
            },
            {
                id: 'gps-tractor-01',
                name: 'John Deere 5075E Orchard Tractor',
                type: 'vehicle_tractor',
                assignedTo: 'David M. (Machinery Operator)',
                protocol: 'TELTONIKA_FMB920',
                imei: '358941098231045',
                status: 'ONLINE',
                batteryPct: 100, // Vehicle 12V alternator
                speedKmh: 12.4,
                headingDeg: 270,
                lat: baseLat - 0.0008,
                lng: baseLng + 0.0022,
                altitudeM: 139,
                accuracyM: 0.8,
                lastPingTime: 'Just now',
                rowAssignment: 'Inter-row Mowing Block B',
                history: [
                    [baseLat - 0.0005, baseLng + 0.0015],
                    [baseLat - 0.0008, baseLng + 0.0022]
                ]
            },
            {
                id: 'gps-truck-01',
                name: 'Field Logistics Hilux 4x4',
                type: 'vehicle_truck',
                assignedTo: 'Weigh Station Transport',
                protocol: 'TRACCAR_OSMAND',
                imei: '860124098319088',
                status: 'ONLINE',
                batteryPct: 98,
                speedKmh: 18.0,
                headingDeg: 350,
                lat: baseLat - 0.0018,
                lng: baseLng - 0.0005,
                altitudeM: 136,
                accuracyM: 1.0,
                lastPingTime: '5s ago',
                rowAssignment: 'Main Access Road & Cold Storage Gate',
                history: [
                    [baseLat - 0.0025, baseLng - 0.0008],
                    [baseLat - 0.0018, baseLng - 0.0005]
                ]
            }
        ];
    });

    const [isSimulating, setIsSimulating] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
    const [pingIntervalSec, setPingIntervalSec] = useState<number>(2);
    const [isSyncWithMapActive, setIsSyncWithMapActive] = useState<boolean>(true);
    const [geofenceAlerts, setGeofenceAlerts] = useState<string[]>([]);
    const [rawNmeaLog, setRawNmeaLog] = useState<string[]>([]);

    // Save to storage
    useEffect(() => {
        safeStorage.setItem('agrimap_gps_devices', JSON.stringify(devices));
    }, [devices]);

    // Dispatch global GPS update to Plantation Map
    const broadcastGpsTelemetry = (currentDevices: GpsDevice[]) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('agrimap:gps_live_update', {
                detail: {
                    devices: currentDevices,
                    timestamp: Date.now()
                }
            }));
        }

        if (onSyncWithMapFeatures) {
            onSyncWithMapFeatures(currentDevices);
        }
    };

    // Live Telemetry Simulation Loop
    useEffect(() => {
        if (!isSimulating) return;

        const interval = setInterval(() => {
            setDevices(prev => {
                const nextDevices = prev.map(dev => {
                    // Small kinematic delta simulating movement along rows or paths
                    let latDelta = 0;
                    let lngDelta = 0;
                    let speed = dev.speedKmh;

                    if (dev.type === 'worker_jacket') {
                        // Walking speed 1.5 - 3.5 km/h along blueberry rows
                        speed = Math.max(1.2, Math.min(4.0, dev.speedKmh + (Math.random() - 0.5) * 0.4));
                        latDelta = (Math.random() - 0.48) * 0.00008;
                        lngDelta = 0.00006 * (Math.sin(Date.now() / 15000));
                    } else if (dev.type === 'vehicle_tractor') {
                        // Tractor speed 8 - 14 km/h
                        speed = Math.max(6.0, Math.min(15.0, dev.speedKmh + (Math.random() - 0.5) * 0.8));
                        latDelta = 0.00012 * (Math.cos(Date.now() / 20000));
                        lngDelta = (Math.random() - 0.48) * 0.00015;
                    } else {
                        // Truck speed 15 - 25 km/h
                        speed = Math.max(10.0, Math.min(28.0, dev.speedKmh + (Math.random() - 0.5) * 1.2));
                        latDelta = 0.00018 * (Math.sin(Date.now() / 18000));
                        lngDelta = 0.00015 * (Math.cos(Date.now() / 18000));
                    }

                    const newLat = Number((dev.lat + latDelta).toFixed(6));
                    const newLng = Number((dev.lng + lngDelta).toFixed(6));
                    const newHistory = [...dev.history.slice(-20), [newLat, newLng] as [number, number]];

                    return {
                        ...dev,
                        lat: newLat,
                        lng: newLng,
                        speedKmh: Number(speed.toFixed(1)),
                        headingDeg: (dev.headingDeg + Math.round((Math.random() - 0.5) * 10) + 360) % 360,
                        batteryPct: Math.max(15, dev.batteryPct - (Math.random() > 0.8 ? 1 : 0)),
                        lastPingTime: 'Just now',
                        history: newHistory
                    };
                });

                // Generate realistic NMEA $GPRMC sentence for selected device
                const sel = nextDevices.find(d => d.id === selectedDeviceId) || nextDevices[0];
                if (sel) {
                    const now = new Date();
                    const utcTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
                    const nmea = `$GPRMC,${utcTime},A,${Math.abs(sel.lat).toFixed(4)},${sel.lat >= 0 ? 'N' : 'S'},${Math.abs(sel.lng).toFixed(4)},${sel.lng >= 0 ? 'E' : 'W'},${(sel.speedKmh * 0.5399).toFixed(1)},${sel.headingDeg},230926,,,A*7A`;
                    setRawNmeaLog(prevN => [nmea, ...prevN.slice(0, 7)]);
                }

                if (isSyncWithMapActive) {
                    broadcastGpsTelemetry(nextDevices);
                }

                return nextDevices;
            });
        }, pingIntervalSec * 1000);

        return () => clearInterval(interval);
    }, [isSimulating, pingIntervalSec, selectedDeviceId, isSyncWithMapActive]);

    const handleAddGpsDevice = () => {
        const id = `gps-${Date.now()}`;
        const newDev: GpsDevice = {
            id,
            name: `Worker Smart Jacket #${devices.length + 1}`,
            type: 'worker_jacket',
            assignedTo: 'New Field Worker',
            protocol: 'TELTONIKA_GH5200',
            imei: `86472904819${Math.floor(1000 + Math.random() * 9000)}`,
            status: 'ONLINE',
            batteryPct: 100,
            speedKmh: 2.2,
            headingDeg: 90,
            lat: baseLat + (Math.random() - 0.5) * 0.003,
            lng: baseLng + (Math.random() - 0.5) * 0.003,
            altitudeM: 140,
            accuracyM: 1.5,
            lastPingTime: 'Just now',
            rowAssignment: 'Block A Patrol',
            history: []
        };
        setDevices(prev => [newDev, ...prev]);
        setSelectedDeviceId(id);
        toast.success(`Registered new GPS tracker: ${newDev.name}`);
    };

    const handleRemoveDevice = (id: string) => {
        setDevices(prev => prev.filter(d => d.id !== id));
        toast.info('GPS tracker unlinked from system.');
    };

    const selectedDevice = devices.find(d => d.id === selectedDeviceId) || devices[0];

    return (
        <div className="space-y-6">
            {/* Header with Simulator Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                        <Navigation className="text-blue-600" size={24} />
                        GPS Telemetry & Worker Jacket Tracking Center
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                        Real-time GPS jacket telemetry for workers & tractors, geofencing protocols, and map tracking
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => {
                            setIsSimulating(!isSimulating);
                            if (!isSimulating) {
                                toast.success('Live GPS simulation active. Telemetry streaming to Plantation Map.');
                            } else {
                                toast.info('GPS simulation paused.');
                            }
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 active:scale-95 cursor-pointer ${
                            isSimulating 
                                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                        {isSimulating ? <Pause size={16} /> : <Play size={16} />}
                        {isSimulating ? 'Pause GPS Stream' : 'Start Live GPS Stream'}
                    </button>

                    {/* Active Profile Plantation Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-xl border border-emerald-500/50 shadow-sm text-xs">
                        <span className="text-emerald-500 font-bold">🌿</span>
                        <select
                            value={selectedPlantationName}
                            onChange={(e) => {
                                const targetName = e.target.value;
                                const item = plantationList.find(p => p.name === targetName) || mainPlantation;
                                setSelectedPlantationName(targetName);
                                window.dispatchEvent(new CustomEvent('agrimap:fly-to-location', { detail: { center: item.center, name: item.name } }));
                                toast.success(`რუკა გადაფრინდა: ${item.name}`);
                            }}
                            className="bg-transparent text-emerald-600 dark:text-emerald-300 font-bold font-mono outline-none cursor-pointer max-w-[170px] truncate"
                            title="Bound Plantation Area for GPS Telemetry"
                        >
                            {plantationList.map((p, idx) => (
                                <option key={`gps-p-${p.id}-${idx}`} value={p.name} className="bg-slate-950 text-slate-200">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                const item = plantationList.find(p => p.name === selectedPlantationName) || mainPlantation;
                                window.dispatchEvent(new CustomEvent('agrimap:fly-to-location', { detail: { center: item.center, name: item.name } }));
                                toast.success(`რუკა გადაფრინდა: ${item.name}`);
                            }}
                            className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500 cursor-pointer transition-colors"
                            title="Fly to Plantation"
                        >
                            <Navigation size={12} />
                        </button>
                    </div>

                    <button
                        onClick={handleAddGpsDevice}
                        className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                        <Plus size={15} /> Add GPS Jacket / Car
                    </button>
                </div>
            </div>

            {/* Quick Fleet Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Active Trackers</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {devices.filter(d => d.status === 'ONLINE').length} <span className="text-xs text-slate-400 font-bold">/ {devices.length} Online</span>
                    </p>
                    <span className="text-[8px] font-bold text-emerald-600 uppercase mt-1 block">
                        ● All Teltonika & Traccar Pings OK
                    </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Worker Jackets</span>
                    <p className="text-2xl font-black text-blue-600 mt-1">
                        {devices.filter(d => d.type === 'worker_jacket').length}
                    </p>
                    <span className="text-[8px] font-bold text-slate-500 uppercase mt-1 block">
                        Wearing Teltonika GH5200 Vest
                    </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Field Machinery</span>
                    <p className="text-2xl font-black text-amber-600 mt-1">
                        {devices.filter(d => d.type.startsWith('vehicle')).length}
                    </p>
                    <span className="text-[8px] font-bold text-slate-500 uppercase mt-1 block">
                        Tractors & Trucks with CAN-GPS
                    </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Map Live Feed</span>
                    <button
                        onClick={() => {
                            setIsSyncWithMapActive(!isSyncWithMapActive);
                            toast.info(`Plantation Map GPS sync: ${!isSyncWithMapActive ? 'ACTIVE' : 'MUTED'}`);
                        }}
                        className={`mt-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            isSyncWithMapActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                    >
                        {isSyncWithMapActive ? 'Map Sync ON' : 'Map Sync OFF'}
                    </button>
                </div>
            </div>

            {/* Main Interactive Fleet Inspector & Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Fleet Devices List (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                            Connected GPS Trackers Fleet
                        </h4>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">
                            Ping: {pingIntervalSec}s
                        </span>
                    </div>

                    <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                        {devices.map(dev => {
                            const isSelected = selectedDeviceId === dev.id;
                            const isJacket = dev.type === 'worker_jacket';
                            return (
                                <div
                                    key={dev.id}
                                    onClick={() => setSelectedDeviceId(dev.id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                        isSelected 
                                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 ring-2 ring-blue-500/20 shadow-md' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl text-white ${isJacket ? 'bg-blue-600' : 'bg-amber-600'}`}>
                                                {isJacket ? <User size={16} /> : <Truck size={16} />}
                                            </div>
                                            <div className="min-w-0">
                                                <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">
                                                    {dev.name}
                                                </h5>
                                                <p className="text-[10px] text-slate-500 font-bold truncate">
                                                    {dev.assignedTo || 'Unassigned'} • {dev.rowAssignment || 'Field'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                {dev.speedKmh} km/h
                                            </span>
                                            <p className="text-[8px] font-mono text-slate-400 mt-0.5">
                                                Bat: {dev.batteryPct}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px]">
                                        <span className="font-mono text-slate-400">
                                            {dev.lat.toFixed(4)}, {dev.lng.toFixed(4)}
                                        </span>
                                        <span className="font-bold text-slate-500 uppercase">
                                            {dev.protocol.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Device Telemetry Cockpit (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                    {selectedDevice ? (
                        <div className="p-6 bg-slate-900 text-white rounded-[2rem] border border-slate-800 shadow-xl space-y-5">
                            {/* Cockpit Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-blue-600/30 text-blue-400 border border-blue-500/40">
                                            {selectedDevice.type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs font-mono text-slate-400">
                                            IMEI: {selectedDevice.imei}
                                        </span>
                                    </div>
                                    <h4 className="text-lg font-black uppercase tracking-tight text-white mt-1">
                                        {selectedDevice.name}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-bold">
                                        Assigned to: <span className="text-emerald-400">{selectedDevice.assignedTo}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <button
                                        onClick={() => handleRemoveDevice(selectedDevice.id)}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all"
                                        title="Unlink Tracker"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Live Telemetry Gauges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <span className="text-[8px] font-black uppercase text-slate-500 flex items-center gap-1">
                                        <Gauge size={10} className="text-blue-400" /> Ground Speed
                                    </span>
                                    <p className="text-xl font-mono font-black text-white mt-1">
                                        {selectedDevice.speedKmh} <span className="text-[10px] text-slate-400">km/h</span>
                                    </p>
                                </div>
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <span className="text-[8px] font-black uppercase text-slate-500 flex items-center gap-1">
                                        <Compass size={10} className="text-indigo-400" /> Heading
                                    </span>
                                    <p className="text-xl font-mono font-black text-white mt-1">
                                        {selectedDevice.headingDeg}° <span className="text-[10px] text-slate-400">Azimuth</span>
                                    </p>
                                </div>
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <span className="text-[8px] font-black uppercase text-slate-500 flex items-center gap-1">
                                        <Battery size={10} className="text-emerald-400" /> Battery
                                    </span>
                                    <p className="text-xl font-mono font-black text-emerald-400 mt-1">
                                        {selectedDevice.batteryPct}%
                                    </p>
                                </div>
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                                    <span className="text-[8px] font-black uppercase text-slate-500 flex items-center gap-1">
                                        <Radio size={10} className="text-amber-400" /> GPS Precision
                                    </span>
                                    <p className="text-xl font-mono font-black text-white mt-1">
                                        ±{selectedDevice.accuracyM} <span className="text-[10px] text-slate-400">m</span>
                                    </p>
                                </div>
                            </div>

                            {/* Coordinates & Row Details */}
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-slate-400">Latitude:</span>
                                    <span className="text-white font-bold">{selectedDevice.lat.toFixed(6)}° N</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-slate-400">Longitude:</span>
                                    <span className="text-white font-bold">{selectedDevice.lng.toFixed(6)}° W</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-slate-400">Assigned Row:</span>
                                    <span className="text-amber-400 font-bold">{selectedDevice.rowAssignment}</span>
                                </div>
                            </div>

                            {/* Real-time NMEA Sentence Stream */}
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">
                                    Live NMEA 0183 / Protocol Packet Feed:
                                </span>
                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] text-emerald-400 space-y-1 overflow-x-auto">
                                    {rawNmeaLog.length > 0 ? (
                                        rawNmeaLog.map((line, idx) => (
                                            <div key={idx} className="truncate">
                                                {line}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-600">Start simulation to inspect live NMEA sentence stream.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                            Select a GPS tracker from the fleet list to inspect telemetry.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
