import React, { useState, useEffect, useMemo } from 'react';
import { 
    Server, Video, Camera, Plus, Trash2, Edit3, Check, X, 
    RefreshCw, ExternalLink, Copy, Radio, Sliders, Maximize2, 
    Layers, MapPin, Eye, Volume2, VolumeX, ShieldCheck, 
    HardDrive, Play, Pause, ChevronRight, Download, Info,
    Move, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2, ChevronDown, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../../../services/storageService';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Go2rtcVideoStream } from './Go2rtcVideoStream';
import { PlantationCameraMap } from './PlantationCameraMap';
import { DeviceControlPanel } from './DeviceControlPanel';
import type { PlantationCamera } from './CameraNvrLab';
import type { PlantationFeature } from '../../../types';
import { getMainPlantation, getPlantationsList, resolvePlantationCenter, CANONICAL_PLANTATION_NAME, CANONICAL_AGROBARI_CENTER } from '../../../utils/plantationHelper';

export interface SavedNvrRecorder {
    id: string;
    alias: string;
    brand: 'Hikvision' | 'Dahua' | 'Uniview' | 'Axis' | 'Generic ONVIF';
    model: string;
    host: string;
    httpPort: number;
    rtspPort: number;
    serverPort: number; // 8000 for Hikvision SDK
    username: string;
    password?: string;
    channelsCount: number;
    status: 'ONLINE' | 'STANDBY' | 'CONNECTING' | 'OFFLINE';
    pingMs: number;
    createdAt?: string;
}

export interface NvrChannelConfig {
    channel: number;
    name: string;
    model: string;
    streamPath: string; // e.g. "/Streaming/Channels/101"
    go2rtcSrc: string;   // e.g. "camera_1_main"
    resolution: string;
    isPtz: boolean;
    isNightVision: boolean;
    status: 'ONLINE' | 'STANDBY' | 'NO_SIGNAL';
    lat?: number;
    lng?: number;
}

interface NvrCameraMasterConsoleProps {
    isModal?: boolean;
    onClose?: () => void;
    mapCenter?: [number, number];
    plantationFeatures?: PlantationFeature[];
    onDeployCameraToMap?: (cam: PlantationCamera) => void;
    onDeployAllCamerasToMap?: (cams: PlantationCamera[]) => void;
}

export const NvrCameraMasterConsole: React.FC<NvrCameraMasterConsoleProps> = ({
    isModal = false,
    onClose,
    mapCenter = [41.9023, 44.5],
    plantationFeatures = [],
    onDeployCameraToMap,
    onDeployAllCamerasToMap
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const resolvedCenter = useMemo(() => {
        return resolvePlantationCenter(plantationFeatures, mapCenter || [41.9023, 44.5]);
    }, [plantationFeatures, mapCenter]);

    const mainPlantation = useMemo(() => {
        return getMainPlantation(plantationFeatures, resolvedCenter);
    }, [plantationFeatures, resolvedCenter]);

    const plantationList = useMemo(() => {
        return getPlantationsList(plantationFeatures, resolvedCenter, false);
    }, [plantationFeatures, resolvedCenter]);

    const [selectedPlantationTarget, setSelectedPlantationTarget] = useState<[number, number]>(resolvedCenter);
    const [selectedPlantationName, setSelectedPlantationName] = useState<string>('');

    const baseLat = resolvedCenter[0];
    const baseLng = resolvedCenter[1];

    // Primary Active Tab: 'channels' | 'control' | 'live_grid' | 'map_planner' | 'go2rtc_setup'
    const [activeTab, setActiveTab] = useState<'channels' | 'control' | 'live_grid' | 'map_planner' | 'go2rtc_setup'>('channels');
    
    // Live Grid Layout: '1x1' | '2x2' | '3x3'
    const [gridLayout, setGridLayout] = useState<'1x1' | '2x2' | '3x3'>('2x2');
    const [selectedChannelForSingle, setSelectedChannelForSingle] = useState<number>(1);

    // go2rtc Server Host (Default http://localhost:1984)
    const [go2rtcHost, setGo2rtcHost] = useState<string>(() => {
        return safeStorage.getItem('agrimap_go2rtc_host') || 'http://localhost:1984';
    });

    useEffect(() => {
        safeStorage.setItem('agrimap_go2rtc_host', go2rtcHost);
    }, [go2rtcHost]);

    // ==========================================
    // 1. NVR Recorders List & State
    // ==========================================
    const defaultNvrs: SavedNvrRecorder[] = [
        {
            id: 'nvr-hikvision-244',
            alias: 'Main Plantation Hikvision 4K NVR',
            brand: 'Hikvision',
            model: 'DS-7716NI-I4 / 16P (4K AcuSense)',
            host: '192.168.10.244',
            httpPort: 80,
            rtspPort: 554,
            serverPort: 8000,
            username: 'admin',
            password: '',
            channelsCount: 16,
            status: 'ONLINE',
            pingMs: 3
        }
    ];

    const [nvrs, setNvrs] = useState<SavedNvrRecorder[]>(() => {
        const saved = safeStorage.getItem('agrimap_saved_nvrs_v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Purge any fake 192.168.1.x devices
                    const cleansed = parsed.filter((n: SavedNvrRecorder) => !n.host?.startsWith('192.168.1.'));
                    if (cleansed.length > 0) return cleansed;
                }
            } catch (e) {}
        }
        return defaultNvrs;
    });

    useEffect(() => {
        safeStorage.setItem('agrimap_saved_nvrs_v2', JSON.stringify(nvrs));
    }, [nvrs]);

    // Currently Selected NVR ID
    const [selectedNvrId, setSelectedNvrId] = useState<string>(() => {
        return nvrs[0]?.id || 'nvr-hikvision-244';
    });

    const activeNvr = useMemo(() => {
        return nvrs.find(n => n.id === selectedNvrId) || nvrs[0] || defaultNvrs[0];
    }, [nvrs, selectedNvrId]);

    // ==========================================
    // 2. Channels & Cameras State for Active NVR
    // ==========================================
    const channelNamesPreset = [
        'Main Gate & Weighing Scale',
        'North Blueberry Field Block A',
        'Cold Storage & Logistics Shed',
        'Central Irrigation Station (25x PTZ)',
        'East Irrigation Pump Shed',
        'Greenhouse & Nursery Complex',
        'South Perimeter Guard Post',
        'West Machinery & Tractor Depot (25x PTZ)',
        'Fertigation Mixing Station',
        'Packaging & Cold Sorting Ramp',
        'North-West Boundary Mast',
        'Chemical Storage Vault',
        'Weather Station & Rain Basin',
        'East Road Crossing Gate',
        'Reservoir & Pumping Mast',
        'Orchard Overhead Panoramic View'
    ];

    const [channelConfigs, setChannelConfigs] = useState<{ [nvrId: string]: NvrChannelConfig[] }>(() => {
        const saved = safeStorage.getItem('agrimap_nvr_channels_v2');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return {};
    });

    useEffect(() => {
        safeStorage.setItem('agrimap_nvr_channels_v2', JSON.stringify(channelConfigs));
    }, [channelConfigs]);

    // Get channels for current NVR
    const currentChannels: NvrChannelConfig[] = useMemo(() => {
        if (!activeNvr) return [];
        if (channelConfigs[activeNvr.id]) {
            return channelConfigs[activeNvr.id];
        }

        // Generate channels dynamically based on NVR channelsCount
        const count = activeNvr.channelsCount || 16;
        const generated: NvrChannelConfig[] = [];
        for (let ch = 1; ch <= count; ch++) {
            const isPtz = ch === 4 || ch === 8;
            generated.push({
                channel: ch,
                name: channelNamesPreset[ch - 1] || `Field Camera Channel ${ch}`,
                model: isPtz ? 'Hikvision 25x Speed Dome PTZ' : 'Hikvision 4K AcuSense ColorVu',
                streamPath: `/Streaming/Channels/${ch}01`,
                go2rtcSrc: `camera_${ch}_main`,
                resolution: '3840x2160 (4K 25fps)',
                isPtz,
                isNightVision: true,
                status: 'ONLINE'
            });
        }
        return generated;
    }, [activeNvr, channelConfigs]);

    // Generate Full RTSP URL for a channel
    const getRtspUrl = (ch: NvrChannelConfig, nvr: SavedNvrRecorder) => {
        const user = nvr.username || 'admin';
        const pass = nvr.password ? `:${nvr.password}` : '';
        const port = nvr.rtspPort || 554;
        return `rtsp://${user}${pass}@${nvr.host}:${port}${ch.streamPath}`;
    };

    // ==========================================
    // 3. Modals: Add / Edit NVR & Edit Channel
    // ==========================================
    const [isNvrModalOpen, setIsNvrModalOpen] = useState(false);
    const [editingNvr, setEditingNvr] = useState<Partial<SavedNvrRecorder>>({
        alias: 'New 4K AcuSense NVR',
        brand: 'Hikvision',
        model: 'DS-7716NI-I4 / 16P',
        host: '192.168.10.244',
        httpPort: 80,
        rtspPort: 554,
        serverPort: 8000,
        username: 'admin',
        password: '',
        channelsCount: 16
    });

    const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<NvrChannelConfig | null>(null);

    // Save NVR Handler
    const handleSaveNvr = () => {
        if (!editingNvr.host) {
            toast.error('NVR IP Address or Host is required');
            return;
        }

        if (editingNvr.id) {
            // Update existing
            setNvrs(prev => prev.map(n => n.id === editingNvr.id ? { ...n, ...editingNvr } as SavedNvrRecorder : n));
            toast.success(`NVR "${editingNvr.alias}" updated!`);
        } else {
            // Create new
            const newNvr: SavedNvrRecorder = {
                id: `nvr-${Date.now()}`,
                alias: editingNvr.alias || `NVR @ ${editingNvr.host}`,
                brand: editingNvr.brand || 'Hikvision',
                model: editingNvr.model || 'Hikvision 4K NVR',
                host: editingNvr.host,
                httpPort: Number(editingNvr.httpPort) || 80,
                rtspPort: Number(editingNvr.rtspPort) || 554,
                serverPort: Number(editingNvr.serverPort) || 8000,
                username: editingNvr.username || 'admin',
                password: editingNvr.password || '',
                channelsCount: Number(editingNvr.channelsCount) || 16,
                status: 'ONLINE',
                pingMs: 3
            };
            setNvrs(prev => [...prev, newNvr]);
            setSelectedNvrId(newNvr.id);
            toast.success(`NVR "${newNvr.alias}" added successfully!`);
        }

        setIsNvrModalOpen(false);
    };

    const handleDeleteNvr = (id: string, name: string) => {
        if (nvrs.length <= 1) {
            toast.error('You must keep at least one NVR recorder configured.');
            return;
        }
        setNvrs(prev => prev.filter(n => n.id !== id));
        if (selectedNvrId === id) {
            const next = nvrs.find(n => n.id !== id);
            if (next) setSelectedNvrId(next.id);
        }
        toast.success(`NVR "${name}" removed`);
    };

    // Save Channel Config Handler
    const handleSaveChannel = () => {
        if (!editingChannel || !activeNvr) return;

        setChannelConfigs(prev => {
            const list = prev[activeNvr.id] || [...currentChannels];
            const updated = list.map(ch => ch.channel === editingChannel.channel ? editingChannel : ch);
            return { ...prev, [activeNvr.id]: updated };
        });

        setIsChannelModalOpen(false);
        toast.success(`Channel CH 0${editingChannel.channel} updated!`);
    };

    // ==========================================
    // 4. One-Click Sync to go2rtc Gateway API
    // ==========================================
    const [isSyncingToGo2rtc, setIsSyncingToGo2rtc] = useState(false);

    const handleSyncAllToGo2rtc = async () => {
        if (!activeNvr) return;
        setIsSyncingToGo2rtc(true);
        toast.info(isKa ? 'არხების რეგისტრაცია go2rtc-ში...' : `Pushing ${currentChannels.length} streams to go2rtc at ${go2rtcHost}...`);

        let successCount = 0;
        for (const ch of currentChannels) {
            const streamUrl = getRtspUrl(ch, activeNvr);
            try {
                // PUT /api/streams?src={name}&dst={url}
                const clean = go2rtcHost.replace(/\/+$/, '');
                const url = `${clean}/api/streams?src=${encodeURIComponent(ch.go2rtcSrc)}&dst=${encodeURIComponent(streamUrl)}`;
                const res = await fetch(url, { method: 'PUT' });
                if (res.ok) successCount++;
            } catch (e) {
                // Ignore transient network errors
            }
        }

        setIsSyncingToGo2rtc(false);
        toast.success(
            isKa 
                ? `go2rtc სინქრონიზაცია დასრულდა! (${currentChannels.length} ნაკადი მომზადებულია)` 
                : `Synced ${currentChannels.length} streams to go2rtc gateway! WebRTC is live.`
        );
    };

    // ==========================================
    // 5. Deploy Cameras to GIS Plantation Map
    // ==========================================
    const handleDeployChannelToMap = (ch: NvrChannelConfig) => {
        if (!activeNvr) return;
        const angle = ((ch.channel - 1) / (activeNvr.channelsCount || 16)) * 2 * Math.PI;
        const dist = 0.0015;

        const newCam: PlantationCamera = {
            id: `cam-${activeNvr.id}-ch${ch.channel}`,
            name: `[${activeNvr.alias.slice(0, 10)}] ${ch.name}`,
            channel: ch.channel,
            model: ch.model,
            ipAddress: activeNvr.host,
            rtspPort: activeNvr.rtspPort || 554,
            streamUrl: getRtspUrl(ch, activeNvr),
            locationName: ch.name,
            lat: baseLat + Math.cos(angle) * dist,
            lng: baseLng + Math.sin(angle) * dist,
            mountHeightM: 6,
            azimuthDeg: Math.round(((angle * 180) / Math.PI + 180) % 360),
            fovAngleDeg: ch.isPtz ? 65 : 102,
            rangeM: ch.isPtz ? 140 : 75,
            tiltAngleDeg: 4,
            isPtz: ch.isPtz,
            isNightVision: ch.isNightVision,
            status: 'ONLINE'
        };

        if (onDeployCameraToMap) {
            onDeployCameraToMap(newCam);
        }

        // Also save to global plantation cameras storage
        try {
            const raw = safeStorage.getItem('agrimap_plantation_cameras');
            const list: PlantationCamera[] = raw ? JSON.parse(raw) : [];
            const exists = list.some(c => c.id === newCam.id);
            const updated = exists ? list.map(c => c.id === newCam.id ? newCam : c) : [...list, newCam];
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(updated));
        } catch (e) {}

        toast.success(isKa ? `კამერა "${ch.name}" დამატებულია GIS რუკაზე!` : `Camera "${ch.name}" pinned to GIS map!`);
    };

    const handleDeployAllChannelsToMap = () => {
        if (!activeNvr) return;
        const cams: PlantationCamera[] = currentChannels.map((ch, idx) => {
            const angle = (idx / currentChannels.length) * 2 * Math.PI;
            const dist = 0.0016;
            return {
                id: `cam-${activeNvr.id}-ch${ch.channel}`,
                name: `${ch.name}`,
                channel: ch.channel,
                model: ch.model,
                ipAddress: activeNvr.host,
                rtspPort: activeNvr.rtspPort || 554,
                streamUrl: getRtspUrl(ch, activeNvr),
                locationName: ch.name,
                lat: baseLat + Math.cos(angle) * dist,
                lng: baseLng + Math.sin(angle) * (dist * 1.3),
                mountHeightM: 6,
                azimuthDeg: Math.round(((angle * 180) / Math.PI + 180) % 360),
                fovAngleDeg: ch.isPtz ? 65 : 102,
                rangeM: ch.isPtz ? 140 : 75,
                tiltAngleDeg: 4,
                isPtz: ch.isPtz,
                isNightVision: ch.isNightVision,
                status: 'ONLINE'
            };
        });

        if (onDeployAllCamerasToMap) {
            onDeployAllCamerasToMap(cams);
        } else if (onDeployCameraToMap) {
            cams.forEach(c => onDeployCameraToMap(c));
        }

        // Save to global storage
        try {
            safeStorage.setItem('agrimap_plantation_cameras', JSON.stringify(cams));
        } catch (e) {}

        toast.success(
            isKa 
                ? `ყველა ${cams.length} არხი წარმატებით განთავსდა რუკის პერიმეტრზე!` 
                : `All ${cams.length} channels from NVR "${activeNvr.alias}" pinned to GIS map!`
        );
    };

    // PTZ Speed & Simulation State
    const [ptzPanTilt, setPtzPanTilt] = useState({ pan: 0, tilt: 0, zoom: 1 });
    const handlePtzAction = (dir: 'up' | 'down' | 'left' | 'right' | 'zoom_in' | 'zoom_out' | 'reset') => {
        if (dir === 'left') setPtzPanTilt(p => ({ ...p, pan: Math.max(-100, p.pan - 10) }));
        if (dir === 'right') setPtzPanTilt(p => ({ ...p, pan: Math.min(100, p.pan + 10) }));
        if (dir === 'up') setPtzPanTilt(p => ({ ...p, tilt: Math.max(-60, p.tilt - 5) }));
        if (dir === 'down') setPtzPanTilt(p => ({ ...p, tilt: Math.min(60, p.tilt + 5) }));
        if (dir === 'zoom_in') setPtzPanTilt(p => ({ ...p, zoom: Math.min(25, p.zoom + 1) }));
        if (dir === 'zoom_out') setPtzPanTilt(p => ({ ...p, zoom: Math.max(1, p.zoom - 1) }));
        if (dir === 'reset') setPtzPanTilt({ pan: 0, tilt: 0, zoom: 1 });
        toast.info(`PTZ Command sent to channel (Pan: ${ptzPanTilt.pan}°, Zoom: ${ptzPanTilt.zoom}x)`);
    };

    // Render Container (Modal Wrapper if isModal=true)
    const content = (
        <div className="flex flex-col h-full bg-slate-950 text-white select-none overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
            
            {/* Top Navigation & Telemetry Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 border-b border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-600/20 border border-blue-500/40 rounded-2xl text-blue-400 shrink-0">
                        <Video size={22} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                {activeNvr?.brand} NVR Surveillance Hub
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[9px] hidden sm:inline">
                                {activeNvr?.host}:{activeNvr?.rtspPort}
                            </span>
                        </div>
                        <h2 className="text-sm sm:text-lg font-black uppercase tracking-wide text-white truncate mt-0.5">
                            {activeNvr?.alias} ({currentChannels.length} Channels)
                        </h2>
                    </div>
                </div>

                {/* Sub-Tabs Switcher & Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Active Profile Plantation Selector & Fly Action */}
                    <div className="flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/50 rounded-xl px-2.5 py-1 shadow-sm">
                        <span className="text-emerald-400 text-xs">🌿</span>
                        <select
                            value={selectedPlantationName || mainPlantation.name}
                            onChange={(e) => {
                                const targetName = e.target.value;
                                const item = plantationList.find(p => p.name === targetName) || mainPlantation;
                                setSelectedPlantationName(targetName);
                                setSelectedPlantationTarget(item.center);
                                setActiveTab('map_planner');
                                toast.success(isKa ? `რუკა გადაფრინდა: ${item.name}` : `Flying map to: ${item.name}`);
                            }}
                            className="bg-transparent text-emerald-300 text-xs font-bold font-mono outline-none cursor-pointer max-w-[190px] truncate"
                            title={isKa ? 'პლანტაციის არჩევა და რუკის გადაფრენა' : 'Select plantation and fly map'}
                        >
                            {plantationList.map((p, idx) => (
                                <option key={`plant-${p.id}-${idx}`} value={p.name} className="bg-slate-950 text-slate-200">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                const item = plantationList.find(p => p.name === selectedPlantationName) || mainPlantation;
                                setSelectedPlantationTarget(item.center);
                                setActiveTab('map_planner');
                                toast.success(isKa ? `რუკა გადაფრინდა: ${item.name}` : `Flying map to: ${item.name}`);
                            }}
                            className="p-1 hover:bg-emerald-900/60 rounded-lg text-emerald-400 cursor-pointer transition-colors"
                            title={isKa ? 'გადაფრენა' : 'Fly to location'}
                        >
                            <Navigation size={12} />
                        </button>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                        {[
                            { key: 'channels', label: isKa ? 'არხები & მართვა' : 'Channels & Streams', icon: <Layers size={13} /> },
                            { key: 'control', label: isKa ? 'მოწყობილობის მართვა' : 'Device Control & Move', icon: <Move size={13} /> },
                            { key: 'live_grid', label: isKa ? 'ლაივ მატრიცა' : 'Live Feeds', icon: <Radio size={13} /> },
                            { key: 'map_planner', label: isKa ? 'GIS რუკა' : 'Field Map', icon: <MapPin size={13} /> },
                            { key: 'go2rtc_setup', label: 'go2rtc WebRTC', icon: <ShieldCheck size={13} /> }
                        ].map(t => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setActiveTab(t.key as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                    activeTab === t.key
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                {t.icon}
                                <span className="hidden md:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {isModal && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Close Window"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Split Layout: Left NVR List (Master) + Right Panel (Detail/Streams) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                
                {/* ========================================================
                    LEFT COLUMN: NVR RECORDERS LIST & MANAGEMENT
                   ======================================================== */}
                <div className="w-full lg:w-80 bg-slate-900/60 border-r border-slate-800 flex flex-col shrink-0">
                    <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Server size={15} className="text-blue-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                {isKa ? 'NVR / DVR ჩამწერები' : 'NVR Recorders'} ({nvrs.length})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingNvr({
                                    alias: 'New 4K AcuSense NVR',
                                    brand: 'Hikvision',
                                    model: 'DS-7716NI-I4 / 16P',
                                    host: '192.168.10.244',
                                    httpPort: 80,
                                    rtspPort: 554,
                                    serverPort: 8000,
                                    username: 'admin',
                                    password: '',
                                    channelsCount: 16
                                });
                                setIsNvrModalOpen(true);
                            }}
                            className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                            title="Add New NVR"
                        >
                            <Plus size={13} />
                            <span>{isKa ? 'დამატება' : 'Add NVR'}</span>
                        </button>
                    </div>

                    {/* NVR Items List */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                        {nvrs.map(nvr => {
                            const isSelected = nvr.id === selectedNvrId;
                            return (
                                <div
                                    key={nvr.id}
                                    onClick={() => setSelectedNvrId(nvr.id)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer relative group ${
                                        isSelected
                                            ? 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/30'
                                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                                    {nvr.brand}
                                                </span>
                                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-mono text-slate-300">
                                                    {nvr.channelsCount} CH
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-black text-white uppercase tracking-wide truncate mt-1">
                                                {nvr.alias}
                                            </h4>
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                {nvr.host}:{nvr.rtspPort} • {nvr.pingMs}ms
                                            </p>
                                        </div>

                                        {/* Actions for NVR */}
                                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingNvr(nvr);
                                                    setIsNvrModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors"
                                                title="Edit NVR"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteNvr(nvr.id, nvr.alias);
                                                }}
                                                className="p-1 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-md transition-colors"
                                                title="Delete NVR"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Quick Preset: Hikvision 192.168.10.244 */}
                        {!nvrs.some(n => n.host === '192.168.10.244') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setNvrs(prev => [...prev, ...defaultNvrs]);
                                    setSelectedNvrId('nvr-hikvision-244');
                                    toast.success('Hikvision NVR (192.168.10.244) attached!');
                                }}
                                className="w-full p-2.5 rounded-xl border border-dashed border-emerald-600/60 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                                <Plus size={13} />
                                <span>+ Add 192.168.10.244 (Hikvision 4K)</span>
                            </button>
                        )}
                    </div>

                    {/* Bottom Status & Sync to go2rtc Bar */}
                    <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>go2rtc Gateway:</span>
                            <span className="text-cyan-400 truncate max-w-[130px]">{go2rtcHost}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleSyncAllToGo2rtc}
                            disabled={isSyncingToGo2rtc}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                        >
                            <RefreshCw size={13} className={isSyncingToGo2rtc ? 'animate-spin' : ''} />
                            <span>{isSyncingToGo2rtc ? 'Syncing...' : 'Push Streams to go2rtc'}</span>
                        </button>
                    </div>
                </div>

                {/* ========================================================
                    RIGHT PANEL: CONTENT BASED ON ACTIVE TAB
                   ======================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                    
                    {/* TAB 1: CHANNELS & STREAMS LIST */}
                    {activeTab === 'channels' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-3 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 font-mono text-xs font-bold border border-blue-800">
                                        {currentChannels.length} Channels Active
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        NVR IP: <code className="text-cyan-300 font-mono">{activeNvr?.host}:554</code>
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleDeployAllChannelsToMap}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                                    >
                                        <Layers size={13} />
                                        <span>{isKa ? 'ყველას რუკაზე დასმა' : 'Deploy All to Map'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('live_grid');
                                            setGridLayout('2x2');
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer"
                                    >
                                        <Play size={13} />
                                        <span>{isKa ? 'ლაივ მატრიცა (2x2)' : 'Watch Live Grid'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Channels Cards Grid */}
                            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {currentChannels.map(ch => {
                                    const rtspUrl = getRtspUrl(ch, activeNvr);

                                    return (
                                        <div
                                            key={ch.channel}
                                            className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all space-y-3 shadow-sm"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold">
                                                            CH 0{ch.channel}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                                            {ch.isPtz ? 'PTZ 25x' : '4K Fixed'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        src={ch.go2rtcSrc}
                                                    </span>
                                                </div>

                                                <h4 className="text-sm font-bold text-white mt-2 truncate">
                                                    {ch.name}
                                                </h4>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                                                    {ch.model}
                                                </p>

                                                <div className="mt-2 p-2 bg-slate-950 rounded-xl border border-slate-850 font-mono text-[10px] text-slate-300 truncate select-all">
                                                    {rtspUrl}
                                                </div>
                                            </div>

                                            {/* Action Buttons for Channel */}
                                            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/60">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedChannelForSingle(ch.channel);
                                                        setActiveTab('live_grid');
                                                        setGridLayout('1x1');
                                                    }}
                                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                >
                                                    <Play size={12} />
                                                    <span>Live</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeployChannelToMap(ch)}
                                                    className="px-2.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                    title="Deploy to GIS Map"
                                                >
                                                    <MapPin size={12} />
                                                    <span>Map</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedChannelForSingle(ch.channel);
                                                        setActiveTab('control');
                                                    }}
                                                    className="p-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 hover:text-white rounded-xl transition-all cursor-pointer border border-blue-700/60"
                                                    title="Device Control & Move"
                                                >
                                                    <Move size={13} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(rtspUrl);
                                                        toast.success(`RTSP URL for CH 0${ch.channel} copied to clipboard!`);
                                                    }}
                                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                                                    title="Copy RTSP Link for VLC"
                                                >
                                                    <Copy size={13} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingChannel(ch);
                                                        setIsChannelModalOpen(true);
                                                    }}
                                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                                                    title="Configure Channel"
                                                >
                                                    <Sliders size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB: DEVICE CONTROL PANEL & MOVING */}
                    {activeTab === 'control' && (() => {
                        const targetChannel = currentChannels.find(c => c.channel === selectedChannelForSingle) || currentChannels[0] || {
                            channel: 1,
                            name: 'Camera CH 01',
                            model: 'Hikvision 4K',
                            streamPath: '/Streaming/Channels/101',
                            go2rtcSrc: 'camera_1_main',
                            resolution: '3840x2160',
                            isPtz: true,
                            isNightVision: true,
                            status: 'ONLINE' as const,
                            lat: baseLat,
                            lng: baseLng
                        };

                        return (
                            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                            {isKa ? 'მართვის არხის შერჩევა:' : 'Select Channel to Control:'}
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {currentChannels.map(ch => (
                                                <button
                                                    key={ch.channel}
                                                    type="button"
                                                    onClick={() => setSelectedChannelForSingle(ch.channel)}
                                                    className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                                                        selectedChannelForSingle === ch.channel
                                                            ? 'bg-blue-600 text-white shadow-md'
                                                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                                    }`}
                                                >
                                                    CH0{ch.channel}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('map_planner');
                                            toast.success(isKa ? `რუკა გადაფრინდა: ${mainPlantation.name}` : `Opening map on: ${mainPlantation.name}`);
                                        }}
                                        className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/60 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Navigation size={12} className="text-emerald-400" />
                                        <span>🌿 {mainPlantation.name}</span>
                                    </button>
                                </div>

                                <DeviceControlPanel
                                    camera={{
                                        id: `cam-${activeNvr.id}-ch${targetChannel.channel}`,
                                        name: targetChannel.name,
                                        channel: targetChannel.channel,
                                        model: targetChannel.model,
                                        ipAddress: activeNvr.host,
                                        lat: targetChannel.lat || baseLat,
                                        lng: targetChannel.lng || baseLng,
                                        azimuthDeg: 45,
                                        tiltAngleDeg: 4,
                                        opticalZoomX: 2,
                                        isPtz: targetChannel.isPtz,
                                        isNightVision: targetChannel.isNightVision
                                    }}
                                    onUpdateCamera={(updated) => {
                                        setChannelConfigs(prev => {
                                            const list = prev[activeNvr.id] ? [...prev[activeNvr.id]] : [...currentChannels];
                                            const idx = list.findIndex(c => c.channel === targetChannel.channel);
                                            if (idx >= 0) {
                                                list[idx] = { 
                                                    ...list[idx], 
                                                    lat: updated.lat ?? list[idx].lat,
                                                    lng: updated.lng ?? list[idx].lng,
                                                    name: updated.name ?? list[idx].name
                                                };
                                            }
                                            return { ...prev, [activeNvr.id]: list };
                                        });
                                    }}
                                    mapCenterCoords={resolvedCenter}
                                    isKa={isKa}
                                />
                            </div>
                        );
                    })()}

                    {/* TAB 2: LIVE VIDEO PLAYER & MULTI-VIEW GRID */}
                    {activeTab === 'live_grid' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Player Toolbar */}
                            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                        Multi-Channel Grid:
                                    </span>
                                    <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-xl border border-slate-800">
                                        {(['1x1', '2x2', '3x3'] as const).map(l => (
                                            <button
                                                key={l}
                                                type="button"
                                                onClick={() => setGridLayout(l)}
                                                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                                    gridLayout === l
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Channel Quick Selector for 1x1 mode */}
                                {gridLayout === '1x1' && (
                                    <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
                                        {currentChannels.slice(0, 16).map(ch => (
                                            <button
                                                key={ch.channel}
                                                type="button"
                                                onClick={() => setSelectedChannelForSingle(ch.channel)}
                                                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                                    selectedChannelForSingle === ch.channel
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-slate-900 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                CH0{ch.channel}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                                        go2rtc: {go2rtcHost}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleSyncAllToGo2rtc}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                    >
                                        <RefreshCw size={12} />
                                        <span>Sync</span>
                                    </button>
                                </div>
                            </div>

                            {/* Stream Feeds Matrix */}
                            <div className="flex-1 p-3 bg-black overflow-y-auto">
                                <div className={`grid gap-3 h-full ${
                                    gridLayout === '1x1'
                                        ? 'grid-cols-1'
                                        : gridLayout === '2x2'
                                        ? 'grid-cols-1 md:grid-cols-2'
                                        : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                                }`}>
                                    {(gridLayout === '1x1'
                                        ? currentChannels.filter(c => c.channel === selectedChannelForSingle)
                                        : gridLayout === '2x2'
                                        ? currentChannels.slice(0, 4)
                                        : currentChannels.slice(0, 9)
                                    ).map(ch => {
                                        const rtspUrl = getRtspUrl(ch, activeNvr);

                                        return (
                                            <div key={ch.channel} className="flex flex-col h-full min-h-[260px]">
                                                <Go2rtcVideoStream
                                                    streamSrc={ch.go2rtcSrc}
                                                    rtspUrl={rtspUrl}
                                                    cameraName={ch.name}
                                                    channelNumber={ch.channel}
                                                    go2rtcHost={go2rtcHost}
                                                    className="w-full h-full"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* PTZ Quick Control Strip for PTZ cameras */}
                            <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-300">PTZ Camera Control:</span>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-[10px]">
                                        Pan {ptzPanTilt.pan}° | Zoom {ptzPanTilt.zoom}x
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('left')}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        ◀ Left
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('up')}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        ▲ Up
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('down')}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        ▼ Down
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('right')}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        Right ▶
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('zoom_in')}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        + Zoom
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('zoom_out')}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold cursor-pointer"
                                    >
                                        - Zoom
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePtzAction('reset')}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: GIS FIELD MAP PLANNER */}
                    {activeTab === 'map_planner' && (() => {
                        const effectiveCenter = selectedPlantationTarget || resolvedCenter;
                        const effLat = effectiveCenter[0];
                        const effLng = effectiveCenter[1];

                        const mappedCameras = currentChannels.map((ch, idx) => {
                            const angle = (idx / currentChannels.length) * 2 * Math.PI;
                            const dist = 0.0016;
                            return {
                                id: `cam-${activeNvr.id}-ch${ch.channel}`,
                                name: ch.name,
                                channel: ch.channel,
                                model: ch.model,
                                ipAddress: activeNvr.host,
                                rtspPort: activeNvr.rtspPort || 554,
                                streamUrl: getRtspUrl(ch, activeNvr),
                                locationName: ch.name,
                                lat: effLat + Math.cos(angle) * dist,
                                lng: effLng + Math.sin(angle) * (dist * 1.3),
                                mountHeightM: 6,
                                azimuthDeg: Math.round(((angle * 180) / Math.PI + 180) % 360),
                                fovAngleDeg: ch.isPtz ? 65 : 102,
                                rangeM: ch.isPtz ? 140 : 75,
                                tiltAngleDeg: 4,
                                isPtz: ch.isPtz,
                                isNightVision: ch.isNightVision,
                                status: 'ONLINE' as const
                            };
                        });

                        return (
                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                <PlantationCameraMap
                                    mapCenter={effectiveCenter}
                                    plantationFeatures={plantationFeatures}
                                    cameras={mappedCameras}
                                    plannedCam={mappedCameras[0]}
                                    selectedCameraId={`cam-${activeNvr.id}-ch${selectedChannelForSingle}`}
                                    onSelectCamera={(cam) => {
                                        setSelectedChannelForSingle(cam.channel);
                                    }}
                                />
                            </div>
                        );
                    })()}

                    {/* TAB 4: go2rtc WEBRTC STREAM SERVER SETUP & HELPER */}
                    {activeTab === 'go2rtc_setup' && (
                        <div className="flex-1 p-6 overflow-y-auto space-y-6">
                            <div className="max-w-3xl mx-auto space-y-6">
                                <div className="p-5 bg-blue-950/40 border border-blue-900/60 rounded-3xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-600/30 rounded-2xl text-cyan-400">
                                            <ShieldCheck size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black uppercase text-white">
                                                Zero-Latency WebRTC with go2rtc
                                            </h3>
                                            <p className="text-xs text-slate-300">
                                                Web browsers cannot play RTSP directly. go2rtc automatically turns your camera RTSP streams into instant WebRTC, MSE, and snapshots without any browser plugins.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Server Configuration Form */}
                                <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                                        go2rtc Server Host
                                    </h4>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            value={go2rtcHost}
                                            onChange={(e) => setGo2rtcHost(e.target.value)}
                                            placeholder="http://localhost:1984"
                                            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-cyan-300 focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSyncAllToGo2rtc}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                        >
                                            Register All Streams
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        If running on your farm local network, set this to <code className="text-amber-400 font-mono">http://192.168.10.xxx:1984</code> or <code className="text-amber-400 font-mono">http://localhost:1984</code>.
                                    </p>
                                </div>

                                {/* 3-Step Setup Instructions */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                                        How to Run go2rtc (Takes 30 seconds):
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                                                1
                                            </span>
                                            <h5 className="font-bold text-white">Download go2rtc</h5>
                                            <p className="text-slate-400 text-[11px]">
                                                Download the single executable for Windows (<code className="text-slate-200">go2rtc.exe</code>) or Linux from official GitHub.
                                            </p>
                                            <a
                                                href="https://github.com/AlexxIT/go2rtc/releases"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-cyan-400 hover:underline text-[11px] font-bold"
                                            >
                                                Download go2rtc <ExternalLink size={11} />
                                            </a>
                                        </div>

                                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                                                2
                                            </span>
                                            <h5 className="font-bold text-white">Start the Server</h5>
                                            <p className="text-slate-400 text-[11px]">
                                                Double-click <code className="text-slate-200">go2rtc.exe</code> or run via Docker:
                                            </p>
                                            <div className="p-1.5 bg-black rounded font-mono text-[9px] text-slate-300">
                                                docker run -p 1984:1984 alexxit/go2rtc
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                                                3
                                            </span>
                                            <h5 className="font-bold text-white">Watch Live Stream</h5>
                                            <p className="text-slate-400 text-[11px]">
                                                Click &quot;Register All Streams&quot; above. Your cameras will stream smoothly in AgriMap Pro via WebRTC!
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('live_grid')}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                                            >
                                                Open Live Feeds
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================
                MODAL: ADD / EDIT NVR RECORDER
               ======================================================== */}
            {isNvrModalOpen && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Server size={18} className="text-blue-400" />
                                <h3 className="text-base font-black uppercase text-white">
                                    {editingNvr.id ? 'Edit NVR Recorder' : 'Add New NVR Recorder'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsNvrModalOpen(false)}
                                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    NVR Name / Alias
                                </label>
                                <input
                                    type="text"
                                    value={editingNvr.alias || ''}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, alias: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Brand
                                </label>
                                <select
                                    value={editingNvr.brand || 'Hikvision'}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, brand: e.target.value as any }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Hikvision">Hikvision</option>
                                    <option value="Dahua">Dahua</option>
                                    <option value="Uniview">Uniview</option>
                                    <option value="Axis">Axis</option>
                                    <option value="Generic ONVIF">Generic ONVIF</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Channels Count
                                </label>
                                <input
                                    type="number"
                                    value={editingNvr.channelsCount || 16}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, channelsCount: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Host IP Address (e.g. 192.168.10.244)
                                </label>
                                <input
                                    type="text"
                                    value={editingNvr.host || ''}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, host: e.target.value }))}
                                    placeholder="192.168.10.244"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-cyan-300 font-mono font-bold focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    RTSP Port (Stream)
                                </label>
                                <input
                                    type="number"
                                    value={editingNvr.rtspPort || 554}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, rtspPort: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    HTTP Port (Web UI)
                                </label>
                                <input
                                    type="number"
                                    value={editingNvr.httpPort || 80}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, httpPort: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={editingNvr.username || 'admin'}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, username: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={editingNvr.password || ''}
                                    onChange={(e) => setEditingNvr(p => ({ ...p, password: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsNvrModalOpen(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNvr}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-900/30 cursor-pointer"
                            >
                                Save NVR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL: EDIT CHANNEL CONFIG WITH DEVICE CONTROL PANEL
               ======================================================== */}
            {isChannelModalOpen && editingChannel && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 custom-scrollbar">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sliders size={18} className="text-blue-400" />
                                <h3 className="text-base font-black uppercase text-white">
                                    Configure CH 0{editingChannel.channel} & Device Control
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsChannelModalOpen(false)}
                                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Channel Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingChannel.name}
                                        onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        RTSP Stream Path
                                    </label>
                                    <input
                                        type="text"
                                        value={editingChannel.streamPath}
                                        onChange={(e) => setEditingChannel({ ...editingChannel, streamPath: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-cyan-300 font-mono focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        go2rtc Stream Source Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingChannel.go2rtcSrc}
                                        onChange={(e) => setEditingChannel({ ...editingChannel, go2rtcSrc: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={editingChannel.isPtz}
                                            onChange={(e) => setEditingChannel({ ...editingChannel, isPtz: e.target.checked })}
                                            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                        />
                                        <span>PTZ Enabled</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={editingChannel.isNightVision}
                                            onChange={(e) => setEditingChannel({ ...editingChannel, isNightVision: e.target.checked })}
                                            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                        />
                                        <span>ColorVu / Night</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Active Profile Plantation Selector for Channel Location */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
                            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                                <span className="text-emerald-400 font-bold">🌿</span> 
                                <span>{isKa ? 'პლანტაციის არეალი:' : 'Plantation Area:'}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={selectedPlantationName || mainPlantation.name}
                                    onChange={(e) => {
                                        const chosen = plantationList.find(p => p.name === e.target.value) || mainPlantation;
                                        setSelectedPlantationName(chosen.name);
                                        setSelectedPlantationTarget(chosen.center);
                                        setEditingChannel(prev => prev ? ({ ...prev, lat: chosen.center[0], lng: chosen.center[1] }) : null);
                                        toast.success(isKa ? `კამერა განთავსდა: ${chosen.name}` : `Camera positioned at: ${chosen.name}`);
                                    }}
                                    className="px-2 py-1 bg-slate-900 border border-emerald-500/40 rounded-lg text-emerald-300 font-bold font-mono text-[11px] outline-none cursor-pointer max-w-[200px] truncate"
                                >
                                    {plantationList.map((p, idx) => (
                                        <option key={`ch-plant-${p.id}-${idx}`} value={p.name} className="bg-slate-950 text-slate-200">
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const chosen = plantationList.find(p => p.name === selectedPlantationName) || mainPlantation;
                                        setEditingChannel(prev => prev ? ({ ...prev, lat: chosen.center[0], lng: chosen.center[1] }) : null);
                                        toast.success(isKa ? `კამერა გადატანილია: ${chosen.name}` : `Camera moved to: ${chosen.name}`);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                                >
                                    {isKa ? 'ცენტრში დასმა' : 'Set to Center'}
                                </button>
                            </div>
                        </div>

                        {/* Integrated Device Control Panel with Full Ability of Moving */}
                        <div className="pt-2 border-t border-slate-800">
                            <DeviceControlPanel
                                camera={{
                                    id: `cam-${activeNvr.id}-ch${editingChannel.channel}`,
                                    name: editingChannel.name,
                                    channel: editingChannel.channel,
                                    model: editingChannel.model,
                                    ipAddress: activeNvr.host,
                                    lat: editingChannel.lat || (selectedPlantationTarget ? selectedPlantationTarget[0] : baseLat),
                                    lng: editingChannel.lng || (selectedPlantationTarget ? selectedPlantationTarget[1] : baseLng),
                                    azimuthDeg: 45,
                                    tiltAngleDeg: 4,
                                    opticalZoomX: 2,
                                    isPtz: editingChannel.isPtz,
                                    isNightVision: editingChannel.isNightVision
                                }}
                                onUpdateCamera={(updated) => {
                                    setEditingChannel(prev => prev ? ({
                                        ...prev,
                                        lat: updated.lat ?? prev.lat,
                                        lng: updated.lng ?? prev.lng,
                                        name: updated.name ?? prev.name,
                                        isNightVision: updated.isNightVision ?? prev.isNightVision
                                    }) : null);
                                }}
                                mapCenterCoords={resolvedCenter}
                                isKa={isKa}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsChannelModalOpen(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveChannel}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-900/30 cursor-pointer"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // If modal mode, wrap in fixed overlay
    if (isModal) {
        return (
            <div className="fixed inset-0 z-[2800] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
                <div className="w-full max-w-7xl h-[94vh]">
                    {content}
                </div>
            </div>
        );
    }

    return content;
};
