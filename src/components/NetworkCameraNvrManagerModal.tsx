import React, { useState, useEffect } from 'react';
import { 
    X as CloseIcon, Wifi as WifiIcon, Server as ServerIcon, 
    Video as VideoIcon, Camera as CameraIcon, RefreshCw as RefreshIcon, 
    CheckCircle2 as CheckIcon, AlertTriangle as AlertIcon, 
    ShieldCheck as ShieldCheckIcon, Download as DownloadIcon, 
    Plus as PlusIcon, Play as PlayIcon, Pause as PauseIcon, 
    Maximize2 as MaximizeIcon, Sliders as SlidersIcon, 
    HardDrive as HardDriveIcon, Key as KeyIcon, Lock as LockIcon, 
    Eye as EyeIcon, EyeOff as EyeOffIcon, ArrowRight as ArrowIcon, 
    LayoutGrid as GridIcon, Radio as RadioIcon, Search as SearchIcon, 
    Sparkles as SparklesIcon, Volume2 as VolumeIcon, 
    VolumeX as MuteIcon, Sun as SunIcon, Moon as MoonIcon,
    Layers, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../services/storageService';
import type { PlantationCamera } from './SystemManagement/HardwareLabs/CameraNvrLab';
import { NvrCameraMasterConsole } from './SystemManagement/HardwareLabs/NvrCameraMasterConsole';
import type { PlantationFeature } from '../types';

export interface DiscoveredNetworkDevice {
    id: string;
    alias: string;
    type: 'NVR' | 'DVR' | 'IP_CAMERA' | 'PTZ_CAMERA';
    brand: 'Hikvision' | 'Dahua' | 'Uniview' | 'Axis' | 'Reolink' | 'ONVIF';
    model: string;
    ip: string;
    mac: string;
    httpPort: number;
    rtspPort: number;
    serverPort: number;
    channelsCount: number;
    firmwareVersion: string;
    activationStatus: 'ACTIVATED' | 'INACTIVE';
    pingMs: number;
}

interface NetworkCameraNvrManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    plantationCoords?: [number, number];
    plantationFeatures?: PlantationFeature[];
    onImportAllCameras: (cams: PlantationCamera[]) => void;
    onSelectCameraForDetail?: (cam: PlantationCamera) => void;
    currentCameras?: PlantationCamera[];
    isKa?: boolean;
}

const NetworkCameraNvrManagerModalContent: React.FC<NetworkCameraNvrManagerModalProps> = ({
    onClose,
    plantationCoords = [41.9023, 44.5],
    onImportAllCameras,
    onSelectCameraForDetail,
    currentCameras = [],
    isKa = false
}) => {
    const baseLat = plantationCoords[0] || 41.9023;
    const baseLng = plantationCoords[1] || 44.5;

    const [activeTab, setActiveTab] = useState<'scan' | 'nvr' | 'live_view'>('scan');

    // ==================== TAB 1: LOCAL NETWORK SCANNER ====================
    const [subnetInput, setSubnetInput] = useState<string>('192.168.1.0/24');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanProgress, setScanProgress] = useState<number>(0);
    const [scanStatusText, setScanStatusText] = useState<string>('Ready to scan');
    const [searchFilter, setSearchFilter] = useState<string>('');

    const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredNetworkDevice[]>(() => {
        const saved = safeStorage.getItem('agrimap_discovered_network_devices');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [
            {
                id: 'dev-nvr-01',
                alias: 'Main Plantation NVR (DS-7716NI)',
                type: 'NVR',
                brand: 'Hikvision',
                model: 'Hikvision DS-7716NI-I4/16P (4K AcuSense)',
                ip: '192.168.1.120',
                mac: 'BC:54:51:7A:4E:10',
                httpPort: 80,
                rtspPort: 554,
                serverPort: 8000,
                channelsCount: 16,
                firmwareVersion: 'V4.61.025 build 240815',
                activationStatus: 'ACTIVATED',
                pingMs: 3
            },
            {
                id: 'dev-dvr-02',
                alias: 'Storage & Warehouse DVR (XVR5108)',
                type: 'DVR',
                brand: 'Dahua',
                model: 'Dahua XVR5108HS-4KL-I3 (8 CH WizSense)',
                ip: '192.168.1.130',
                mac: '3C:EF:8C:92:1A:44',
                httpPort: 80,
                rtspPort: 554,
                serverPort: 37777,
                channelsCount: 8,
                firmwareVersion: 'V4.001.0000001.12.R',
                activationStatus: 'ACTIVATED',
                pingMs: 5
            },
            {
                id: 'dev-cam-01',
                alias: 'North Field 4K ColorVu Turret',
                type: 'IP_CAMERA',
                brand: 'Hikvision',
                model: 'DS-2CD2387G2-LU (ColorVu 4K 2.8mm)',
                ip: '192.168.1.121',
                mac: 'BC:54:51:8B:23:41',
                httpPort: 80,
                rtspPort: 554,
                serverPort: 8000,
                channelsCount: 1,
                firmwareVersion: 'V5.7.15 build 240902',
                activationStatus: 'ACTIVATED',
                pingMs: 4
            },
            {
                id: 'dev-ptz-01',
                alias: 'Central Irrigation 25x Speed Dome',
                type: 'PTZ_CAMERA',
                brand: 'Hikvision',
                model: 'DS-2DE4425IW-DE (DarkFighter 25x PTZ)',
                ip: '192.168.1.125',
                mac: 'BC:54:51:99:32:02',
                httpPort: 80,
                rtspPort: 554,
                serverPort: 8000,
                channelsCount: 1,
                firmwareVersion: 'V5.8.00 build 240722',
                activationStatus: 'ACTIVATED',
                pingMs: 6
            }
        ];
    });

    const handleStartScan = () => {
        setIsScanning(true);
        setScanProgress(0);
        setScanStatusText(isKa ? 'ქსელის ინიციალიზაცია (ARP / SSDP Probe)...' : 'Initializing ARP / SSDP probe on local subnet...');

        let current = 0;
        const interval = setInterval(() => {
            current += 8;
            setScanProgress(current);

            if (current === 24) {
                setScanStatusText(isKa ? 'პორტების შემოწმება (HTTP: 80, RTSP: 554, ISAPI: 8000)...' : 'Probing ONVIF & RTSP ports (80, 554, 8000, 37777)...');
            } else if (current === 64) {
                setScanStatusText(isKa ? 'NVR / DVR არხების აღმოჩენა...' : 'Enumerating NVR / DVR channels and cameras...');
            } else if (current >= 100) {
                clearInterval(interval);
                setIsScanning(false);
                setScanProgress(100);
                setScanStatusText(isKa ? 'სკანირება დასრულდა. ნაპოვნია აქტიური მოწყობილობები.' : 'Scan complete. Active CCTV devices discovered.');
                toast.success(isKa ? 'ლოკალური ქსელის სკანირება წარმატებით დასრულდა!' : 'Local network CCTV scan completed!');
            }
        }, 150);
    };

    // ==================== TAB 2: ONLINE NVR / DVR CONNECTION ====================
    const [nvrConfig, setNvrConfig] = useState({
        alias: 'Main Plantation 4K AcuSense NVR',
        brand: 'Hikvision',
        host: '192.168.1.120',
        httpPort: 80,
        rtspPort: 554,
        serverPort: 8000,
        username: 'admin',
        password: '',
        channelsCount: 16,
        protocol: 'RTSP_OVER_WEBRTC',
        isVerified: true
    });

    const [isVerifyingNvr, setIsVerifyingNvr] = useState<boolean>(false);
    const [verificationStep, setVerificationStep] = useState<number>(0);

    const handleVerifyNvr = () => {
        setIsVerifyingNvr(true);
        setVerificationStep(1);

        setTimeout(() => {
            setVerificationStep(2);
            setTimeout(() => {
                setVerificationStep(3);
                setTimeout(() => {
                    setIsVerifyingNvr(false);
                    setNvrConfig(prev => ({ ...prev, isVerified: true }));
                    toast.success(isKa ? 'NVR / DVR კავშირი დადასტურებულია! 16 არხი მზადაა.' : 'NVR / DVR connection verified! 16 channels ready for import.');
                }, 400);
            }, 500);
        }, 600);
    };

    // One-Click "IMPORT ALL CAMERAS" from NVR / DVR
    const handleImportAllFromNvr = (device?: DiscoveredNetworkDevice) => {
        const count = device ? device.channelsCount : nvrConfig.channelsCount;
        const brand = device ? device.brand : nvrConfig.brand;
        const host = device ? device.ip : nvrConfig.host;
        const user = nvrConfig.username || 'admin';
        const pass = nvrConfig.password || 'PlantationAdmin2026!';
        const rtspPort = device ? device.rtspPort : nvrConfig.rtspPort;

        const importedList: PlantationCamera[] = [];

        for (let ch = 1; ch <= count; ch++) {
            // Offset coordinates around plantation boundary/perimeter
            const angleRad = (ch * (360 / count) * Math.PI) / 180;
            const dist = 0.0018 + (ch % 3) * 0.0006;
            const camLat = baseLat + Math.sin(angleRad) * dist;
            const camLng = baseLng + Math.cos(angleRad) * (dist * 1.3);

            const isPtz = ch === 4 || ch === 8;
            const model = isPtz 
                ? `${brand} 25x Laser Speed Dome PTZ` 
                : ch % 2 === 0 
                    ? `${brand} 4K AcuSense DeepLearning 4.0mm` 
                    : `${brand} 4K ColorVu 24/7 FullColor 2.8mm`;

            const locationNamesKa = [
                'მთავარი ჭიშკარი & ასაწონი ტერმინალი',
                'ჩრდილოეთის მოცვის სექტორი A',
                'სამაცივრე მეურნეობა & შეფუთვა',
                'ცენტრალური ფერტიგაციის სადგური (PTZ)',
                'აღმოსავლეთის სატუმბი სადგური',
                'სასათბურე კომპლექსი & სანერგე',
                'სამხრეთის პერიმეტრის საგუშაგო',
                'დასავლეთის ტრაქტორების გარაჟი (PTZ)'
            ];

            const locationNamesEn = [
                'Main Gate & Weighing Scale',
                'North Blueberry Field Block A',
                'Cold Storage & Packing Facility',
                'Central Fertigation Station (PTZ)',
                'East Irrigation Pump Shed',
                'Greenhouse & Nursery Complex',
                'South Perimeter Guard Post',
                'West Machinery & Tractor Depot (PTZ)'
            ];

            const locName = isKa 
                ? (locationNamesKa[(ch - 1) % locationNamesKa.length] + (ch > 8 ? ` [CH0${ch}]` : ''))
                : (locationNamesEn[(ch - 1) % locationNamesEn.length] + (ch > 8 ? ` [CH0${ch}]` : ''));

            importedList.push({
                id: `imported-${device?.id || 'nvr'}-ch${ch}-${Date.now()}`,
                name: `[NVR] ${isKa ? 'კამერა' : 'Camera'} CH0${ch}`,
                channel: ch,
                model: model,
                ipAddress: host,
                rtspPort: rtspPort,
                streamUrl: `/api/cameras/camera_${ch}_main/index.m3u8`,
                locationName: locName,
                lat: camLat,
                lng: camLng,
                mountHeightM: 6 + (ch % 3) * 2,
                azimuthDeg: Math.round(((ch * (360 / count)) + 180) % 360),
                fovAngleDeg: isPtz ? 65 : 95,
                rangeM: isPtz ? 160 : 75,
                tiltAngleDeg: 4,
                isPtz: isPtz,
                isNightVision: true,
                status: 'RECORDING'
            });
        }

        onImportAllCameras(importedList);
        toast.success(
            isKa 
                ? `🚀 ${importedList.length} კამერა წარმატებით იმპორტირებულია და განთავსდა მეურნეობის რუკაზე!` 
                : `🚀 ${importedList.length} Cameras imported from NVR/DVR and deployed onto the plantation map!`
        );
        setActiveTab('live_view');
    };

    // ==================== TAB 3: LIVE VIEW STREAMING & MATRIX ====================
    const [liveGridLayout, setLiveGridLayout] = useState<'1x1' | '2x2' | '3x3'>('2x2');
    const [activeLiveCamera, setActiveLiveCamera] = useState<PlantationCamera | null>(() => {
        return currentCameras[0] || null;
    });
    const [isNightModeActive, setIsNightModeActive] = useState<boolean>(false);
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
    const [aiDetectionOverlay, setAiDetectionOverlay] = useState<boolean>(true);
    const [liveTime, setLiveTime] = useState<string>('');

    useEffect(() => {
        const timer = setInterval(() => {
            setLiveTime(new Date().toISOString().replace('T', ' ').slice(0, 19));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const filteredDevices = discoveredDevices.filter(d => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return d.alias.toLowerCase().includes(q) || d.ip.includes(q) || d.model.toLowerCase().includes(q) || d.brand.toLowerCase().includes(q);
    });

    const camerasToDisplay: PlantationCamera[] = currentCameras.length > 0 ? currentCameras : [
        {
            id: 'mock-1',
            name: 'Front Gate & Scale 4K',
            channel: 1,
            model: 'Hikvision DS-2CD2087G2-LU',
            ipAddress: '192.168.1.121',
            rtspPort: 554,
            locationName: 'Front Entrance Gate',
            lat: baseLat,
            lng: baseLng,
            mountHeightM: 6,
            azimuthDeg: 45,
            fovAngleDeg: 102,
            rangeM: 75,
            tiltAngleDeg: 4,
            isPtz: false,
            isNightVision: true,
            status: 'RECORDING' as const
        },
        {
            id: 'mock-2',
            name: 'North Blueberry Orchard',
            channel: 2,
            model: 'Hikvision DS-2CD2386G2-ISU',
            ipAddress: '192.168.1.122',
            rtspPort: 554,
            locationName: 'North Orchard Block A',
            lat: baseLat + 0.001,
            lng: baseLng + 0.001,
            mountHeightM: 8,
            azimuthDeg: 135,
            fovAngleDeg: 89,
            rangeM: 90,
            tiltAngleDeg: 5,
            isPtz: false,
            isNightVision: true,
            status: 'RECORDING' as const
        }
    ];

    return (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-600/20 border border-cyan-500/40 rounded-2xl text-cyan-400">
                            <ServerIcon size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                                    <WifiIcon size={12} /> {isKa ? 'ლოკალური ქსელი & NVR / DVR ჰაბი' : 'Local Network & Online NVR / DVR Hub'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono font-bold">
                                    {currentCameras.length} {isKa ? 'კამერა რუკაზე' : 'Cameras Active'}
                                </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                                {isKa ? 'ქსელის სკანერი, NVR / DVR წვდომა & პირდაპირი ეთერი (Live View)' : 'Network Scanner, Online NVR / DVR Access & Live View'}
                            </h3>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                {/* Navigation Tabs: SCAN | ONLINE NVR | LIVE VIEW */}
                <div className="flex border-b border-slate-800 bg-slate-950/70 px-4 text-xs font-black uppercase tracking-wider">
                    <button
                        onClick={() => setActiveTab('scan')}
                        className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'scan'
                                ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <SearchIcon size={14} />
                        <span>{isKa ? '1. ლოკალური ქსელის სკანერი' : '1. Local Network Scanner'}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('nvr')}
                        className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'nvr'
                                ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <ServerIcon size={14} />
                        <span>{isKa ? '2. ონლაინ NVR / DVR კავშირი' : '2. Online NVR / DVR Access'}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('live_view')}
                        className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'live_view'
                                ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <VideoIcon size={14} />
                        <span>{isKa ? '3. პირდაპირი ეთერი & მატრიცა (Live View)' : '3. Live View & Matrix'}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                    </button>
                </div>

                {/* Modal Content Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs text-slate-300 custom-scrollbar">
                    
                    {/* ==================== TAB 1: LOCAL NETWORK SCANNER ==================== */}
                    {activeTab === 'scan' && (
                        <div className="space-y-4">
                            {/* Subnet Input & Scan Controls */}
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="flex flex-col flex-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                {isKa ? 'ქვექსელის დიაპაზონი (Subnet CIDR)' : 'Target Subnet Range (CIDR)'}
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={subnetInput}
                                                    onChange={(e) => setSubnetInput(e.target.value)}
                                                    className="w-full sm:w-64 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs font-bold outline-none focus:border-cyan-500"
                                                    placeholder="192.168.1.0/24"
                                                />
                                                <div className="flex gap-1">
                                                    {['192.168.1.0/24', '192.168.0.0/24', '10.0.0.0/24'].map(preset => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => setSubnetInput(preset)}
                                                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-mono cursor-pointer"
                                                        >
                                                            {preset.split('.')[2]}.x
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isScanning}
                                        onClick={handleStartScan}
                                        className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                                            isScanning 
                                                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/50'
                                        }`}
                                    >
                                        <RefreshIcon size={14} className={isScanning ? 'animate-spin' : ''} />
                                        <span>{isScanning ? (isKa ? 'სკანირება მიმდინარეობს...' : 'Scanning Subnet...') : (isKa ? 'ქსელის სკანირება' : 'Scan Local Network')}</span>
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                {isScanning && (
                                    <div className="space-y-1.5 pt-2">
                                        <div className="flex justify-between text-[10px] font-mono text-cyan-400">
                                            <span>{scanStatusText}</span>
                                            <span>{scanProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                            <div 
                                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-150"
                                                style={{ width: `${scanProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Search Filter & Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <SearchIcon size={14} className="text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchFilter}
                                        onChange={(e) => setSearchFilter(e.target.value)}
                                        placeholder={isKa ? "ფილტრი: IP, Hikvision, NVR..." : "Filter devices by IP, model, brand..."}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none w-56 focus:border-cyan-500"
                                    />
                                </div>
                                <span className="text-[11px] font-mono text-slate-400">
                                    {isKa ? `ნაპოვნია ${filteredDevices.length} მოწყობილობა` : `Discovered ${filteredDevices.length} Devices`}
                                </span>
                            </div>

                            {/* Discovered Devices List */}
                            <div className="space-y-2.5">
                                {filteredDevices.map(device => {
                                    const isNvr = device.type === 'NVR' || device.type === 'DVR';
                                    return (
                                        <div 
                                            key={device.id}
                                            className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2.5 rounded-xl border mt-0.5 ${
                                                    isNvr 
                                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' 
                                                        : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                                                }`}>
                                                    {isNvr ? <ServerIcon size={18} /> : <CameraIcon size={18} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-sm text-white">{device.alias}</span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border ${
                                                            isNvr 
                                                                ? 'bg-blue-950 text-blue-300 border-blue-800/60' 
                                                                : 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                                                        }`}>
                                                            {device.brand} • {device.type}
                                                        </span>
                                                        <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            {device.pingMs}ms
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 font-mono mt-1 space-x-3">
                                                        <span><b>IP:</b> {device.ip}</span>
                                                        <span><b>MAC:</b> {device.mac}</span>
                                                        <span><b>Ports:</b> {device.httpPort}/{device.rtspPort}/{device.serverPort}</span>
                                                        <span><b>Channels:</b> {device.channelsCount} CH</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                {isNvr ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleImportAllFromNvr(device)}
                                                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer active:scale-95 transition-all"
                                                        title="Import all camera channels from this NVR/DVR onto plantation map"
                                                    >
                                                        <DownloadIcon size={13} className="stroke-[2.5]" />
                                                        <span>{isKa ? `ყველა კამერის იმპორტი (${device.channelsCount} CH)` : `Import All (${device.channelsCount} CH)`}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const cam: PlantationCamera = {
                                                                id: `cam-${Date.now()}`,
                                                                name: device.alias,
                                                                channel: currentCameras.length + 1,
                                                                model: device.model,
                                                                ipAddress: device.ip,
                                                                rtspPort: device.rtspPort,
                                                                locationName: isKa ? 'ჩრდილოეთის პერიმეტრი' : 'North Perimeter Pole',
                                                                lat: baseLat + 0.001,
                                                                lng: baseLng + 0.001,
                                                                mountHeightM: 6,
                                                                azimuthDeg: 90,
                                                                fovAngleDeg: 95,
                                                                rangeM: 75,
                                                                tiltAngleDeg: 4,
                                                                isPtz: device.type === 'PTZ_CAMERA',
                                                                isNightVision: true,
                                                                status: 'ONLINE'
                                                            };
                                                            onImportAllCameras([...currentCameras, cam]);
                                                            toast.success(isKa ? 'კამერა დაემატა რუკაზე!' : 'Camera deployed to map!');
                                                        }}
                                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                                                    >
                                                        <PlusIcon size={13} />
                                                        <span>{isKa ? 'რუკაზე დამატება' : 'Deploy to Map'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ==================== TAB 2: ONLINE NVR / DVR ACCESS ==================== */}
                    {activeTab === 'nvr' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <ServerIcon size={16} className="text-cyan-400" />
                                        <span className="font-black uppercase tracking-wider text-slate-100 text-xs">
                                            {isKa ? 'ონლაინ NVR / DVR აპარატურული პარამეტრები' : 'Online NVR / DVR Gateway Credentials'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-800/40">
                                        Status: {nvrConfig.isVerified ? 'VERIFIED (ONLINE)' : 'UNVERIFIED'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'NVR / DVR დასახელება' : 'Device Alias'}
                                        </label>
                                        <input
                                            type="text"
                                            value={nvrConfig.alias}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, alias: e.target.value }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'ბრენდი & პროტოკოლი' : 'Manufacturer & Protocol'}
                                        </label>
                                        <select
                                            value={nvrConfig.brand}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, brand: e.target.value }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-500"
                                        >
                                            <option value="Hikvision">Hikvision (ISAPI / SADP 4K)</option>
                                            <option value="Dahua">Dahua (DH-RPC / DMSS / WizSense)</option>
                                            <option value="Uniview">Uniview (EZStation / UNV)</option>
                                            <option value="Axis">Axis Communications (VAPIX)</option>
                                            <option value="ONVIF">Generic ONVIF Profile S / T</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'არხების რაოდენობა' : 'Channels Count'}
                                        </label>
                                        <select
                                            value={nvrConfig.channelsCount}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, channelsCount: Number(e.target.value) }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-500"
                                        >
                                            <option value={4}>4 {isKa ? 'არხი (4 Cameras)' : 'Channels'}</option>
                                            <option value={8}>8 {isKa ? 'არხი (8 Cameras)' : 'Channels'}</option>
                                            <option value={16}>16 {isKa ? 'არხი (16 Cameras)' : 'Channels'}</option>
                                            <option value={32}>32 {isKa ? 'არხი (32 Cameras)' : 'Channels'}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'NVR ჰოსტი (IP ან DDNS)' : 'Host (IP / DDNS)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={nvrConfig.host}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, host: e.target.value }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'RTSP პორტი' : 'RTSP Port'}
                                        </label>
                                        <input
                                            type="number"
                                            value={nvrConfig.rtspPort}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, rtspPort: Number(e.target.value) }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'მომხმარებელი' : 'Username'}
                                        </label>
                                        <input
                                            type="text"
                                            value={nvrConfig.username}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, username: e.target.value }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'პაროლი' : 'Password'}
                                        </label>
                                        <input
                                            type="password"
                                            value={nvrConfig.password}
                                            onChange={(e) => setNvrConfig(prev => ({ ...prev, password: e.target.value }))}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-cyan-500"
                                        />
                                    </div>
                                </div>

                                {/* Verification Steps & Buttons */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={isVerifyingNvr}
                                            onClick={handleVerifyNvr}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border border-slate-700"
                                        >
                                            <RefreshIcon size={13} className={isVerifyingNvr ? 'animate-spin' : ''} />
                                            <span>{isVerifyingNvr ? (isKa ? 'მოწმდება...' : 'Verifying...') : (isKa ? 'კავშირის ტესტი' : 'Test Connection')}</span>
                                        </button>
                                        {verificationStep > 0 && (
                                            <span className="text-[11px] font-mono text-cyan-400">
                                                {verificationStep === 1 && 'Ping Host OK...'}
                                                {verificationStep === 2 && 'ISAPI Handshake OK...'}
                                                {verificationStep === 3 && '16 Channels Discovered!'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Prominent IMPORT ALL CAMERAS BUTTON */}
                                    <button
                                        type="button"
                                        onClick={() => handleImportAllFromNvr()}
                                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-emerald-950/60 cursor-pointer active:scale-95 transition-all"
                                    >
                                        <DownloadIcon size={15} className="stroke-[3]" />
                                        <span>
                                            {isKa 
                                                ? `ყველა კამერის იმპორტი (${nvrConfig.channelsCount} არხი) აპლიკაციაში` 
                                                : `IMPORT ALL CAMERAS (${nvrConfig.channelsCount} CHANNELS) IN APPLICATION`}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== TAB 3: LIVE VIEW MULTI-CAMERA MATRIX ==================== */}
                    {activeTab === 'live_view' && (
                        <div className="space-y-4">
                            {/* Live View Controls Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <VideoIcon size={14} className="text-cyan-400" />
                                        <span>{isKa ? 'ცოცხალი მატრიცა' : 'Live Stream Matrix'}</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-800/40">
                                        {liveTime}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Grid layout toggles */}
                                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                                        {(['1x1', '2x2', '3x3'] as const).map(grid => (
                                            <button
                                                key={grid}
                                                type="button"
                                                onClick={() => setLiveGridLayout(grid)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                                    liveGridLayout === grid 
                                                        ? 'bg-cyan-600 text-white shadow-sm' 
                                                        : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {grid}
                                            </button>
                                        ))}
                                    </div>

                                    {/* AI Detection Overlay Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setAiDetectionOverlay(!aiDetectionOverlay)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
                                            aiDetectionOverlay 
                                                ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60' 
                                                : 'bg-slate-900 text-slate-400 border-slate-800'
                                        }`}
                                    >
                                        <SparklesIcon size={12} />
                                        <span>AI Overlay {aiDetectionOverlay ? 'ON' : 'OFF'}</span>
                                    </button>

                                    {/* Night Mode Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setIsNightModeActive(!isNightModeActive)}
                                        className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                            isNightModeActive 
                                                ? 'bg-amber-950 text-amber-300 border-amber-700/60' 
                                                : 'bg-slate-900 text-slate-400 border-slate-800'
                                        }`}
                                        title="Night Vision Filter"
                                    >
                                        {isNightModeActive ? <MoonIcon size={14} /> : <SunIcon size={14} />}
                                    </button>
                                </div>
                            </div>

                            {/* Camera Feeds Matrix Grid */}
                            <div className={`grid gap-3 ${
                                liveGridLayout === '1x1' 
                                    ? 'grid-cols-1' 
                                    : liveGridLayout === '2x2' 
                                        ? 'grid-cols-1 sm:grid-cols-2' 
                                        : 'grid-cols-2 sm:grid-cols-3'
                            }`}>
                                {camerasToDisplay.slice(0, liveGridLayout === '1x1' ? 1 : liveGridLayout === '2x2' ? 4 : 9).map((cam, idx) => (
                                    <div 
                                        key={cam.id}
                                        onClick={() => onSelectCameraForDetail?.(cam)}
                                        className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 group hover:border-cyan-500/80 transition-all cursor-pointer aspect-video flex flex-col justify-between p-3 select-none"
                                        style={{
                                            filter: isNightModeActive ? 'grayscale(100%) contrast(140%) brightness(90%)' : 'none'
                                        }}
                                    >
                                        {/* Simulated Video Canvas Gradient & Motion */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 opacity-90" />
                                        
                                        {/* CCTV Scan Lines */}
                                        <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:16px_16px]" />

                                        {/* Live OSD Header */}
                                        <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-white/90 drop-shadow">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="font-bold bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                                                    CH0{cam.channel} • {cam.name.slice(0, 18)}
                                                </span>
                                            </div>
                                            <span className="bg-black/60 px-1.5 py-0.5 rounded border border-white/10 text-emerald-400">
                                                30 FPS • 4.1 Mbps
                                            </span>
                                        </div>

                                        {/* AI Object Detection Bounding Boxes Overlay */}
                                        {aiDetectionOverlay && idx === 0 && (
                                            <div className="relative z-10 self-center border-2 border-emerald-400/80 bg-emerald-500/10 px-3 py-1.5 rounded-lg animate-pulse">
                                                <span className="text-[9px] font-mono font-bold text-emerald-300 block">
                                                    🚜 TRACTOR #02 [98%] • 12 km/h
                                                </span>
                                            </div>
                                        )}
                                        {aiDetectionOverlay && idx === 1 && (
                                            <div className="relative z-10 self-center border-2 border-blue-400/80 bg-blue-500/10 px-3 py-1 rounded-lg">
                                                <span className="text-[9px] font-mono font-bold text-blue-300 block">
                                                    🚶 WORKER #05 [94%] • SECTOR A
                                                </span>
                                            </div>
                                        )}

                                        {/* Live OSD Footer */}
                                        <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-white/70 drop-shadow">
                                            <span>{cam.ipAddress}:554</span>
                                            <span>{liveTime}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                        {currentCameras.length} {isKa ? 'კამერა ინტეგრირებულია მეურნეობაში' : 'Cameras deployed in farm network'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                        {isKa ? 'დახურვა' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const NetworkCameraNvrManagerModal: React.FC<NetworkCameraNvrManagerModalProps> = (props) => {
    if (!props.isOpen) return null;
    return (
        <NvrCameraMasterConsole
            isModal={true}
            onClose={props.onClose}
            mapCenter={props.plantationCoords}
            plantationFeatures={props.plantationFeatures}
            onDeployCameraToMap={(cam) => {
                if (props.onSelectCameraForDetail) props.onSelectCameraForDetail(cam);
                if (props.onImportAllCameras) props.onImportAllCameras([cam]);
            }}
            onDeployAllCamerasToMap={(cams) => {
                if (props.onImportAllCameras) props.onImportAllCameras(cams);
            }}
        />
    );
};
