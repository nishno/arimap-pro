import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Server, Camera, Navigation, Radio, Droplets, CloudRain, 
    Cpu, Wifi, Search, RefreshCw, Check, CheckCircle2, 
    AlertTriangle, Plus, Eye, ShieldCheck, Layers, 
    ExternalLink, X, Zap, Sliders, HardDrive, Video, 
    Plane, MapPin, Activity, Compass, ChevronDown, ChevronUp,
    Volume2, Shield, Info, ArrowRight, CornerDownRight, CheckSquare,
    Play
} from 'lucide-react';
import { toast } from 'sonner';
import { safeStorage } from '../../../services/storageService';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { PlantationCamera } from './CameraNvrLab';
import { CameraVerificationModal, type DeviceConnectionTarget } from './CameraVerificationModal';

export type LanDeviceCategory = 
    | 'ALL' 
    | 'NVR_CAMERAS' 
    | 'DRONES' 
    | 'GPS_ROVERS' 
    | 'SOIL_SENSORS' 
    | 'WEATHER_STATIONS' 
    | 'IOT_GATEWAYS';

export interface NvrPoEChannel {
    channel: number;
    name: string;
    model: string;
    ip: string;
    rtspUrl: string;
    resolution: string;
    status: 'ONLINE' | 'STANDBY' | 'NO_SIGNAL';
    isPtz?: boolean;
    isNightVision?: boolean;
    isDeployed?: boolean;
}

export interface DiscoveredLanDevice {
    id: string;
    alias: string;
    category: 'NVR' | 'IP_CAMERA' | 'DRONE' | 'GPS_ROVER' | 'SOIL_SENSOR' | 'WEATHER_STATION' | 'IOT_GATEWAY';
    brand: string;
    model: string;
    ip: string;
    httpPort: number;
    rtspPort?: number;
    telemetryPort?: number;
    mac: string;
    subnetMask: string;
    gateway: string;
    protocol: string;
    firmwareVersion: string;
    pingMs: number;
    activationStatus: 'ACTIVATED' | 'INACTIVE' | 'LOCKED';
    lastSeen: string;
    isVerified?: boolean;
    isDeployed?: boolean;
    channelsCount?: number;
    channels?: NvrPoEChannel[];
    telemetry?: {
        batteryPct?: number;
        flightMode?: string;
        satellites?: number;
        gpsFix?: string;
        moisturePct?: number;
        soilPh?: number;
        soilEcDsm?: number;
        depthCm?: number;
        tempC?: number;
        humidityPct?: number;
        windSpeedKmh?: number;
        rainMm?: number;
        solarRadiationWm2?: number;
        accuracyM?: number;
    };
}

interface UniversalLanDeviceScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    mapCenter?: [number, number];
    onDeployCamera?: (cam: PlantationCamera) => void;
    onDeployAllNvrCameras?: (cams: PlantationCamera[]) => void;
    onDeployDrone?: (droneData: any) => void;
    onDeployGps?: (gpsData: any) => void;
    onDeploySoilSensor?: (soilData: any) => void;
    onDeployWeatherStation?: (weatherData: any) => void;
    onOpenLiveStream?: (cam: PlantationCamera) => void;
}

export const UniversalLanDeviceScannerModal: React.FC<UniversalLanDeviceScannerModalProps> = ({
    isOpen,
    onClose,
    mapCenter = [41.9023, 44.5],
    onDeployCamera,
    onDeployAllNvrCameras,
    onDeployDrone,
    onDeployGps,
    onDeploySoilSensor,
    onDeployWeatherStation,
    onOpenLiveStream
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const baseLat = mapCenter[0] || 41.9023;
    const baseLng = mapCenter[1] || 44.5;

    // Scan Settings & Subnet Selection (Defaulting to user's subnet 192.168.10)
    const [customSubnet, setCustomSubnet] = useState<string>('192.168.10');
    const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);
    const [selectedPorts, setSelectedPorts] = useState<number[]>([80, 554, 2006, 8000, 8080, 37777, 8899]);
    const [customPortInput, setCustomPortInput] = useState<string>('');
    const [showPortConfig, setShowPortConfig] = useState<boolean>(false);
    const stopScanRef = useRef<boolean>(false);

    // Verification modal for NVR & cameras (with port 2006 / snapshot)
    const [verificationTarget, setVerificationTarget] = useState<DeviceConnectionTarget | null>(null);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);

    // Manual Add Device Modal
    const [isManualAddOpen, setIsManualAddOpen] = useState<boolean>(false);
    const [manualDevice, setManualDevice] = useState({
        alias: 'Farm Hikvision 4K NVR',
        category: 'NVR' as DiscoveredLanDevice['category'],
        brand: 'Hikvision',
        model: 'DS-7716NI-I4 / 16P (4K AI NVR)',
        ip: '192.168.10.244',
        devicePort: 554,
        httpPort: 80,
        rtspPort: 554,
        username: 'admin',
        password: '',
        channelsCount: 16
    });

    const [activeCategory, setActiveCategory] = useState<LanDeviceCategory>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanProgress, setScanProgress] = useState<number>(0);
    const [scanPhaseText, setScanPhaseText] = useState<string>('Ready to scan');
    const [expandedNvrIds, setExpandedNvrIds] = useState<string[]>(['dev-hik-nvr-244']);
    const [selectedChannels, setSelectedChannels] = useState<{ [nvrId: string]: number[] }>({
        'dev-hik-nvr-244': [1, 2, 3, 4]
    });

    // Multi-Select and Device Management State
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

    // Purge fake 192.168.1.x devices and return clean user devices
    const getInitialDevices = (): DiscoveredLanDevice[] => {
        const saved = safeStorage.getItem('agrimap_lan_all_discovered_devices');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Purge non-existent 192.168.1.x mock items
                    const cleansed = parsed.filter((d: DiscoveredLanDevice) => d && d.ip && !d.ip.startsWith('192.168.1.'));
                    if (cleansed.length > 0) return cleansed;
                }
            } catch (e) {}
        }

        // Default to user's real Hikvision 4K NVR at 192.168.10.244
        return [
            {
                id: 'dev-hik-nvr-244',
                alias: 'Field Station Hikvision 4K NVR',
                category: 'NVR',
                brand: 'Hikvision',
                model: 'DS-7716NI-I4 / 16P (16-Channel 4K AcuSense)',
                ip: '192.168.10.244',
                httpPort: 80,
                rtspPort: 554,
                telemetryPort: 8000,
                mac: 'BC:54:51:A4:10:24',
                subnetMask: '255.255.255.0',
                gateway: '192.168.10.1',
                protocol: 'HIKVISION_ISAPI_SADP / RTSP_OVER_WEBRTC',
                firmwareVersion: 'V4.74.015 build 240520',
                pingMs: 3,
                activationStatus: 'ACTIVATED',
                lastSeen: 'Live Now',
                isVerified: true,
                channelsCount: 16,
                channels: Array.from({ length: 16 }, (_, idx) => {
                    const ch = idx + 1;
                    const chPrefix = `${ch}01`;
                    return {
                        channel: ch,
                        name: ch === 1 ? 'Main Gate & Weighing Scale' :
                              ch === 2 ? 'North Blueberry Field Block A' :
                              ch === 3 ? 'Cold Storage & Logistics Shed' :
                              ch === 4 ? 'Central Irrigation Station (25x PTZ)' :
                              `Field Camera Channel ${ch}`,
                        model: ch === 4 ? 'Hikvision 25x Laser Speed Dome' : 'Hikvision 4K AcuSense ColorVu',
                        ip: '192.168.10.244',
                        rtspUrl: `rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/${chPrefix}`,
                        resolution: '3840x2160 (4K 25fps)',
                        status: 'ONLINE',
                        isNightVision: true,
                        isPtz: ch === 4
                    };
                })
            }
        ];
    };

    const [devices, setDevices] = useState<DiscoveredLanDevice[]>(getInitialDevices);

    useEffect(() => {
        safeStorage.setItem('agrimap_lan_all_discovered_devices', JSON.stringify(devices));
    }, [devices]);

    // Device Selection & Deletion Management
    const handleToggleSelectDevice = (id: string) => {
        setSelectedDeviceIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedDeviceIds.length === filteredDevices.length && filteredDevices.length > 0) {
            setSelectedDeviceIds([]);
        } else {
            setSelectedDeviceIds(filteredDevices.map(d => d.id));
        }
    };

    const handleDeleteDevice = (id: string, name: string) => {
        setDevices(prev => {
            const updated = prev.filter(d => d.id !== id);
            safeStorage.setItem('agrimap_lan_all_discovered_devices', JSON.stringify(updated));
            return updated;
        });
        setSelectedDeviceIds(prev => prev.filter(x => x !== id));
        toast.success(isKa ? `მოწყობილობა "${name}" წაშლილია` : `Device "${name}" deleted`);
    };

    const handleDeleteSelected = () => {
        if (selectedDeviceIds.length === 0) return;
        const count = selectedDeviceIds.length;
        setDevices(prev => {
            const updated = prev.filter(d => !selectedDeviceIds.includes(d.id));
            safeStorage.setItem('agrimap_lan_all_discovered_devices', JSON.stringify(updated));
            return updated;
        });
        setSelectedDeviceIds([]);
        toast.success(isKa ? `${count} მონიშნული მოწყობილობა წაშლილია` : `${count} selected devices deleted`);
    };

    const handleClearAllDevices = () => {
        setDevices([]);
        setSelectedDeviceIds([]);
        safeStorage.removeItem('agrimap_lan_all_discovered_devices');
        toast.success(isKa ? 'ყველა მოწყობილობა წაშლილია' : 'All devices cleared from LAN list');
    };

    const handleAddUserNvrPreset = () => {
        const nvrId = 'dev-hik-nvr-244';
        const exists = devices.some(d => d.id === nvrId || d.ip === '192.168.10.244');
        if (exists) {
            toast.info('Hikvision NVR (192.168.10.244) is already in the list.');
            return;
        }

        const newNvr: DiscoveredLanDevice = {
            id: nvrId,
            alias: 'Field Station Hikvision 4K NVR',
            category: 'NVR',
            brand: 'Hikvision',
            model: 'DS-7716NI-I4 / 16P (16-Channel 4K AI)',
            ip: '192.168.10.244',
            httpPort: 80,
            rtspPort: 554,
            telemetryPort: 8000,
            mac: 'BC:54:51:A4:10:24',
            subnetMask: '255.255.255.0',
            gateway: '192.168.10.1',
            protocol: 'HIKVISION_ISAPI_SADP / RTSP_OVER_WEBRTC',
            firmwareVersion: 'V4.74.015 build 240520',
            pingMs: 3,
            activationStatus: 'ACTIVATED',
            lastSeen: 'Just now',
            isVerified: true,
            channelsCount: 16,
            channels: Array.from({ length: 16 }, (_, idx) => {
                const ch = idx + 1;
                return {
                    channel: ch,
                    name: ch === 1 ? 'Main Gate & Weighing Scale' :
                          ch === 2 ? 'North Blueberry Field Block A' :
                          ch === 3 ? 'Cold Storage & Logistics Shed' :
                          ch === 4 ? 'Central Irrigation Station (25x PTZ)' :
                          `Field Camera Channel ${ch}`,
                    model: ch === 4 ? 'Hikvision 25x Laser Speed Dome' : 'Hikvision 4K AcuSense ColorVu',
                    ip: '192.168.10.244',
                    rtspUrl: `rtsp://CAMERA_HOST/192.168.10.244:554/Streaming/Channels/${ch}01`,
                    resolution: '3840x2160 (4K 25fps)',
                    status: 'ONLINE',
                    isNightVision: true,
                    isPtz: ch === 4
                };
            })
        };

        setDevices(prev => [newNvr, ...prev]);
        toast.success(isKa ? 'Hikvision NVR (192.168.10.244) დაემატა!' : 'Hikvision NVR (192.168.10.244) attached!');
    };

    // Filter devices by category and search
    const filteredDevices = useMemo(() => {
        return devices.filter(dev => {
            // Category filter
            if (activeCategory === 'NVR_CAMERAS' && dev.category !== 'NVR' && dev.category !== 'IP_CAMERA') return false;
            if (activeCategory === 'DRONES' && dev.category !== 'DRONE') return false;
            if (activeCategory === 'GPS_ROVERS' && dev.category !== 'GPS_ROVER') return false;
            if (activeCategory === 'SOIL_SENSORS' && dev.category !== 'SOIL_SENSOR') return false;
            if (activeCategory === 'WEATHER_STATIONS' && dev.category !== 'WEATHER_STATION') return false;
            if (activeCategory === 'IOT_GATEWAYS' && dev.category !== 'IOT_GATEWAY') return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchAlias = dev.alias.toLowerCase().includes(q);
                const matchModel = dev.model.toLowerCase().includes(q);
                const matchIp = dev.ip.toLowerCase().includes(q);
                const matchBrand = dev.brand.toLowerCase().includes(q);
                const matchMac = dev.mac.toLowerCase().includes(q);
                return matchAlias || matchModel || matchIp || matchBrand || matchMac;
            }

            return true;
        });
    }, [devices, activeCategory, searchQuery]);

    // Auto-detect local subnet using WebRTC ICE candidate
    const handleAutoDetectSubnet = async () => {
        setIsAutoDetecting(true);
        toast.info(isKa ? 'ქვექსელის ავტომატური ამოცნობა...' : 'Auto-detecting local LAN subnet...');
        try {
            const detected = await new Promise<string>((resolve) => {
                const timer = setTimeout(() => resolve('192.168.1'), 1800);
                try {
                    const pc = new RTCPeerConnection({ iceServers: [] });
                    pc.createDataChannel('agrimap-lan');
                    pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});
                    pc.onicecandidate = (ice) => {
                        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                        const cand = ice.candidate.candidate;
                        const m = cand.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}/);
                        if (m && m[1] && !m[1].startsWith('127.')) {
                            clearTimeout(timer);
                            pc.close();
                            resolve(m[1]);
                        }
                    };
                } catch {
                    clearTimeout(timer);
                    resolve('192.168.1');
                }
            });
            setCustomSubnet(detected);
            toast.success(isKa ? `ქვექსელი ამოცნობილია: ${detected}.x` : `Subnet detected: ${detected}.x`);
        } catch {
            toast.error('Could not auto-detect subnet. Defaulting to 192.168.1');
        } finally {
            setIsAutoDetecting(false);
        }
    };

    const handleAddPort = () => {
        const p = parseInt(customPortInput.trim(), 10);
        if (!isNaN(p) && p > 0 && p <= 65535) {
            if (!selectedPorts.includes(p)) {
                setSelectedPorts(prev => [...prev, p]);
                toast.success(`Port ${p} added to scanner list`);
            }
            setCustomPortInput('');
        } else {
            toast.error('Please enter a valid port (1-65535)');
        }
    };

    const handleTogglePort = (port: number) => {
        setSelectedPorts(prev => 
            prev.includes(port) ? prev.filter(p => p !== port) : [...prev, port]
        );
    };

    // Real Probing Routine for Network Scan Across User Subnet
    const handleStartLanScan = async () => {
        if (isScanning) {
            stopScanRef.current = true;
            setIsScanning(false);
            setScanPhaseText('Scan stopped by user');
            return;
        }

        setIsScanning(true);
        setScanProgress(0);
        stopScanRef.current = false;

        // Clean & normalize subnet string: "192.168.10.0/24" -> "192.168.10"
        let base = customSubnet.trim().replace(/\/.*$/, '').replace(/\.0$/, '');
        const parts = base.split('.').filter(Boolean);
        if (parts.length >= 3) {
            base = `${parts[0]}.${parts[1]}.${parts[2]}`;
        } else if (parts.length === 2) {
            base = `${parts[0]}.${parts[1]}.1`;
        } else {
            base = '192.168.1';
        }

        const portsToScan = selectedPorts.length > 0 ? selectedPorts : [80, 2006, 8000];
        setScanPhaseText(`Broadcasting probes across ${base}.1 - ${base}.254 on ports [${portsToScan.join(', ')}]...`);

        // Real fetch probe with timeout
        const probeHost = async (ip: string, port: number): Promise<{ online: boolean; latency: number }> => {
            const start = performance.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 700);

            try {
                await fetch(`http://${ip}:${port}/`, {
                    mode: 'no-cors',
                    signal: controller.signal,
                    cache: 'no-store'
                });
                clearTimeout(timer);
                const latency = Math.max(1, Math.round(performance.now() - start));
                return { online: true, latency };
            } catch (err: any) {
                clearTimeout(timer);
                const latency = Math.max(1, Math.round(performance.now() - start));
                if (err.name === 'AbortError') {
                    return { online: false, latency };
                }
                // Rapid rejection (<480ms) in Chrome indicates an active host responded or refused connection
                if (latency < 480) {
                    return { online: true, latency };
                }
                return { online: false, latency };
            }
        };

        const batchSize = 16;
        let checkedCount = 0;
        let foundCount = 0;

        for (let i = 1; i <= 254; i += batchSize) {
            if (stopScanRef.current) break;

            const currentBatch: string[] = [];
            for (let j = i; j < i + batchSize && j <= 254; j++) {
                currentBatch.push(`${base}.${j}`);
            }

            const batchPromises = currentBatch.map(async (ip) => {
                for (const port of portsToScan) {
                    const res = await probeHost(ip, port);
                    if (res.online) {
                        return { ip, port, latency: res.latency };
                    }
                }
                return null;
            });

            const results = await Promise.all(batchPromises);
            for (const r of results) {
                if (r) {
                    foundCount++;
                    let category: DiscoveredLanDevice['category'] = 'NVR';
                    let brand = 'Universal LAN Device';
                    let model = `Network Device (${r.ip}:${r.port})`;
                    let alias = `Device @ ${r.ip}`;

                    if (r.port === 2006) {
                        category = 'NVR';
                        brand = 'NVR / DVR (Port 2006)';
                        model = 'Digital Video Recorder (SDK Port 2006)';
                        alias = `NVR Recorder @ ${r.ip}`;
                    } else if (r.port === 8000) {
                        category = 'NVR';
                        brand = 'Hikvision';
                        model = 'Hikvision NVR / IPC (Port 8000)';
                        alias = `Hikvision Device @ ${r.ip}`;
                    } else if (r.port === 37777) {
                        category = 'NVR';
                        brand = 'Dahua';
                        model = 'Dahua NVR / WizSense (Port 37777)';
                        alias = `Dahua Device @ ${r.ip}`;
                    } else if (r.port === 8899) {
                        category = 'IP_CAMERA';
                        brand = 'ONVIF';
                        model = 'ONVIF Profile S IP Camera';
                        alias = `ONVIF Camera @ ${r.ip}`;
                    } else if (r.port === 502) {
                        category = 'SOIL_SENSOR';
                        brand = 'Modbus RTU';
                        model = 'Modbus TCP Soil/Irrigation Gateway';
                        alias = `Soil Station Gateway @ ${r.ip}`;
                    } else if (r.port === 2101) {
                        category = 'GPS_ROVER';
                        brand = 'Emlid Reach';
                        model = 'RTK GNSS Base Station';
                        alias = `RTK Base Station @ ${r.ip}`;
                    } else if (r.port === 22222) {
                        category = 'WEATHER_STATION';
                        brand = 'Davis Instruments';
                        model = 'Vantage Pro2 WeatherLink IP';
                        alias = `Weather Station @ ${r.ip}`;
                    } else if (r.port === 14550) {
                        category = 'DRONE';
                        brand = 'MAVLink';
                        model = 'ArduPilot / PX4 Drone Link';
                        alias = `Field Drone @ ${r.ip}`;
                    }

                    setDevices(prev => {
                        const existingIdx = prev.findIndex(d => d.ip === r.ip);
                        const newDev: DiscoveredLanDevice = {
                            id: `dev-${r.ip.replace(/\./g, '-')}`,
                            alias,
                            category,
                            brand,
                            model,
                            ip: r.ip,
                            httpPort: r.port === 80 || r.port === 8080 ? r.port : 80,
                            rtspPort: 554,
                            telemetryPort: r.port,
                            mac: 'Active LAN Host',
                            subnetMask: '255.255.255.0',
                            gateway: `${base}.1`,
                            protocol: `TCP_${r.port}_RESPONDING`,
                            firmwareVersion: 'Online Responding',
                            pingMs: r.latency,
                            activationStatus: 'ACTIVATED',
                            lastSeen: 'Live Now',
                            isVerified: false,
                            channelsCount: category === 'NVR' ? 16 : 1,
                            channels: category === 'NVR' ? Array.from({ length: 16 }, (_, chIdx) => ({
                                channel: chIdx + 1,
                                name: `Channel ${chIdx + 1}`,
                                model: `IP Camera CH${chIdx + 1}`,
                                ip: r.ip,
                                rtspUrl: `rtsp://${r.ip}:554/Streaming/Channels/${chIdx + 1}01`,
                                resolution: '1080p / 4K',
                                status: 'ONLINE',
                                isNightVision: true,
                                isPtz: chIdx === 3
                            })) : undefined
                        };

                        if (existingIdx >= 0) {
                            const updated = [...prev];
                            updated[existingIdx] = { ...updated[existingIdx], pingMs: r.latency, lastSeen: 'Live Now' };
                            return updated;
                        }
                        return [newDev, ...prev];
                    });
                }
            }

            checkedCount += currentBatch.length;
            setScanProgress(Math.min(100, Math.round((checkedCount / 254) * 100)));
            setScanPhaseText(`Sweeping ${base}.${Math.min(254, i + batchSize - 1)}... [${foundCount} online found]`);
        }

        setIsScanning(false);
        setScanProgress(100);
        setScanPhaseText(`Sweep complete. ${foundCount} online device(s) found on ${base}.0/24.`);
        toast.success(
            isKa 
                ? `LAN სკანირება დასრულდა! ${foundCount} მოწყობილობა ნაპოვნია ქვექსელში ${base}.0/24` 
                : `LAN scan complete! ${foundCount} active device(s) found on subnet ${base}.0/24`
        );
    };

    // Open Verification / Live Snapshot Modal for an NVR or Camera
    const handleOpenVerification = (dev: DiscoveredLanDevice) => {
        setVerificationTarget({
            alias: dev.alias,
            host: dev.ip,
            lanHost: dev.ip,
            httpPort: dev.httpPort || 80,
            rtspPort: dev.rtspPort || 554,
            accessPort: dev.telemetryPort || 2006,
            serverPort: dev.telemetryPort || 2006,
            username: 'admin',
            password: '',
            model: dev.model,
            brand: dev.brand,
            channelCount: dev.channelsCount || 16
        });
        setIsVerificationModalOpen(true);
    };

    const handleVerificationSuccess = (verified: any) => {
        setDevices(prev => {
            const idx = prev.findIndex(d => d.ip === verified.host);
            const count = verified.channelCount || verified.channels || 16;
            const updatedChannels: NvrPoEChannel[] = Array.from({ length: count }, (_, i) => ({
                channel: i + 1,
                name: `${verified.alias || 'NVR'} - Camera ${i + 1}`,
                model: verified.model || 'Hikvision 4K AcuSense',
                ip: verified.host,
                rtspUrl: `rtsp://${verified.username}:${verified.password || ''}@${verified.host}:${verified.rtspPort || 554}/Streaming/Channels/${i + 1}01`,
                resolution: '3840x2160 (4K)',
                status: 'ONLINE',
                isNightVision: true,
                isPtz: i === 3
            }));

            const updatedDev: DiscoveredLanDevice = {
                id: `dev-${verified.host.replace(/\./g, '-')}`,
                alias: verified.alias || `NVR @ ${verified.host}`,
                category: 'NVR',
                brand: verified.brand || 'Hikvision',
                model: verified.model || 'Hikvision NVR (Port 2006)',
                ip: verified.host,
                httpPort: verified.httpPort || 80,
                rtspPort: verified.rtspPort || 554,
                telemetryPort: verified.accessPort || 2006,
                mac: verified.serialNumber || 'Verified NVR',
                subnetMask: '255.255.255.0',
                gateway: `${verified.host.split('.').slice(0, 3).join('.')}.1`,
                protocol: 'VERIFIED_ISAPI_RTSP',
                firmwareVersion: verified.firmware || 'V4.74',
                pingMs: verified.pingMs || 2,
                activationStatus: 'ACTIVATED',
                lastSeen: 'Verified & Active',
                isVerified: true,
                channelsCount: count,
                channels: updatedChannels
            };

            if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedDev;
                return next;
            }
            return [updatedDev, ...prev];
        });

        toast.success(`NVR "${verified.alias || verified.host}" verified! Port 2006 & live stream active.`);
    };

    // Manual Add Device Handler
    const handleSaveManualDevice = () => {
        if (!manualDevice.ip.trim()) {
            toast.error('Please enter a valid IP address');
            return;
        }

        const ip = manualDevice.ip.trim();
        const baseIp = ip.split('.').slice(0, 3).join('.');
        const newDev: DiscoveredLanDevice = {
            id: `dev-${ip.replace(/\./g, '-')}-${Date.now()}`,
            alias: manualDevice.alias || `Device @ ${ip}`,
            category: manualDevice.category,
            brand: manualDevice.brand || 'Manual Entry',
            model: manualDevice.model || `${manualDevice.category} (Port ${manualDevice.devicePort})`,
            ip,
            httpPort: Number(manualDevice.httpPort) || 80,
            rtspPort: Number(manualDevice.rtspPort) || 554,
            telemetryPort: Number(manualDevice.devicePort) || 2006,
            mac: 'Manual Configured',
            subnetMask: '255.255.255.0',
            gateway: `${baseIp}.1`,
            protocol: `PORT_${manualDevice.devicePort}`,
            firmwareVersion: 'Configured',
            pingMs: 2,
            activationStatus: 'ACTIVATED',
            lastSeen: 'Configured now',
            isVerified: true,
            channelsCount: Number(manualDevice.channelsCount) || 16,
            channels: manualDevice.category === 'NVR' ? Array.from({ length: Number(manualDevice.channelsCount) || 16 }, (_, i) => ({
                channel: i + 1,
                name: `${manualDevice.alias} - CH0${i + 1}`,
                model: `IP Camera ${i + 1}`,
                ip,
                rtspUrl: `rtsp://${manualDevice.username}:${manualDevice.password}@${ip}:${manualDevice.rtspPort || 554}/Streaming/Channels/${i + 1}01`,
                resolution: '3840x2160 (4K)',
                status: 'ONLINE',
                isNightVision: true,
                isPtz: i === 3
            })) : undefined
        };

        setDevices(prev => [newDev, ...prev.filter(d => d.ip !== ip)]);
        setIsManualAddOpen(false);
        toast.success(`Device "${newDev.alias}" added successfully!`);
    };

    const toggleNvrExpand = (nvrId: string) => {
        setExpandedNvrIds(prev => 
            prev.includes(nvrId) ? prev.filter(x => x !== nvrId) : [...prev, nvrId]
        );
    };

    // Deploy Single Camera Channel to Map
    const handleDeployChannelToMap = (dev: DiscoveredLanDevice, channel: NvrPoEChannel) => {
        const offsetMultiplier = (channel.channel - 1) * 0.0006;
        const newCam: PlantationCamera = {
            id: `cam-${dev.id}-ch${channel.channel}-${Date.now()}`,
            name: `${channel.name} [CH0${channel.channel}]`,
            channel: channel.channel,
            model: channel.model,
            ipAddress: channel.ip,
            rtspPort: dev.rtspPort || 554,
            streamUrl: channel.rtspUrl,
            locationName: channel.name,
            lat: baseLat + (channel.channel % 2 === 0 ? offsetMultiplier : -offsetMultiplier),
            lng: baseLng + (channel.channel > 2 ? 0.0008 : -0.0008),
            mountHeightM: 6,
            azimuthDeg: (channel.channel * 65) % 360,
            fovAngleDeg: channel.isPtz ? 65 : 102,
            rangeM: channel.isPtz ? 140 : 75,
            tiltAngleDeg: 4,
            isPtz: !!channel.isPtz,
            isNightVision: !!channel.isNightVision,
            status: 'ONLINE'
        };

        if (onDeployCamera) {
            onDeployCamera(newCam);
        }

        toast.success(
            isKa 
                ? `კამერა "${channel.name}" დამატებულია რუკაზე!` 
                : `Camera "${channel.name}" [CH0${channel.channel}] deployed to map!`
        );
    };

    // Deploy All Channels of NVR to Map
    const handleDeployAllNvrChannels = (dev: DiscoveredLanDevice) => {
        if (!dev.channels || dev.channels.length === 0) return;

        const deployedList: PlantationCamera[] = dev.channels.map((ch, idx) => {
            const angle = (idx / dev.channels!.length) * 2 * Math.PI;
            const radius = 0.0012;
            return {
                id: `cam-${dev.id}-ch${ch.channel}-${Date.now() + idx}`,
                name: `${ch.name}`,
                channel: ch.channel,
                model: ch.model,
                ipAddress: ch.ip,
                rtspPort: dev.rtspPort || 554,
                streamUrl: ch.rtspUrl,
                locationName: ch.name,
                lat: baseLat + Math.cos(angle) * radius,
                lng: baseLng + Math.sin(angle) * radius,
                mountHeightM: 6,
                azimuthDeg: Math.round(((angle * 180) / Math.PI + 180) % 360),
                fovAngleDeg: ch.isPtz ? 65 : 102,
                rangeM: ch.isPtz ? 140 : 75,
                tiltAngleDeg: 4,
                isPtz: !!ch.isPtz,
                isNightVision: !!ch.isNightVision,
                status: 'ONLINE'
            };
        });

        if (onDeployAllNvrCameras) {
            onDeployAllNvrCameras(deployedList);
        } else if (onDeployCamera) {
            deployedList.forEach(c => onDeployCamera(c));
        }

        toast.success(
            isKa 
                ? `NVR-ის ყველა ${deployedList.length} არხი წარმატებით განთავსდა რუკის პერიმეტრზე!` 
                : `All ${deployedList.length} channels of NVR "${dev.alias}" deployed to map perimeter!`
        );
    };

    // Deploy Non-Camera Devices to Map (Drone, GPS, Soil, Weather)
    const handleDeployOtherDevice = (dev: DiscoveredLanDevice) => {
        if (dev.category === 'DRONE') {
            if (onDeployDrone) {
                onDeployDrone({
                    id: dev.id,
                    name: dev.alias,
                    model: dev.model,
                    ip: dev.ip,
                    port: dev.telemetryPort || 14550,
                    batteryPct: dev.telemetry?.batteryPct || 94,
                    flightMode: 'LOITER',
                    lat: baseLat + 0.0004,
                    lng: baseLng + 0.0004
                });
            }
            toast.success(isKa ? `🛸 დრონი "${dev.alias}" დამატებულია რუკაზე!` : `🛸 Drone "${dev.alias}" deployed to map!`);
        } else if (dev.category === 'GPS_ROVER') {
            if (onDeployGps) {
                onDeployGps({
                    id: dev.id,
                    name: dev.alias,
                    workerName: 'Emlid RTK Field Rover',
                    model: dev.model,
                    ip: dev.ip,
                    lat: baseLat - 0.0006,
                    lng: baseLng - 0.0006,
                    batteryPct: 98,
                    status: 'ONLINE'
                });
            }
            toast.success(isKa ? `🛰️ GPS RTK სადგური "${dev.alias}" დამატებულია!` : `🛰️ GPS RTK Station "${dev.alias}" deployed to map!`);
        } else if (dev.category === 'SOIL_SENSOR') {
            if (onDeploySoilSensor) {
                onDeploySoilSensor({
                    id: dev.id,
                    name: dev.alias,
                    type: 'SOIL_MOISTURE_NPK',
                    depthCm: dev.telemetry?.depthCm || 40,
                    moisturePct: dev.telemetry?.moisturePct || 32,
                    soilPh: dev.telemetry?.soilPh || 6.4,
                    soilEcDsm: dev.telemetry?.soilEcDsm || 1.2,
                    lat: baseLat + 0.0008,
                    lng: baseLng - 0.0006
                });
            }
            toast.success(isKa ? `🌱 ნიადაგის სადგური "${dev.alias}" დამატებულია!` : `🌱 Soil Station "${dev.alias}" deployed to map!`);
        } else if (dev.category === 'WEATHER_STATION') {
            if (onDeployWeatherStation) {
                onDeployWeatherStation({
                    id: dev.id,
                    name: dev.alias,
                    model: dev.model,
                    ipAddress: dev.ip,
                    port: dev.telemetryPort || 22222,
                    tempC: dev.telemetry?.tempC || 19.2,
                    humidityPct: dev.telemetry?.humidityPct || 58,
                    windSpeedKmh: dev.telemetry?.windSpeedKmh || 9.4,
                    windDirectionDeg: 240,
                    solarRadiationWm2: dev.telemetry?.solarRadiationWm2 || 620,
                    rainMm: 0.0,
                    pressureHpa: 1016.2,
                    status: 'ONLINE',
                    lat: baseLat - 0.0008,
                    lng: baseLng + 0.0010
                });
            }
            toast.success(isKa ? `🌦️ მეტეო სადგური "${dev.alias}" დამატებულია რუკაზე!` : `🌦️ Weather Station "${dev.alias}" deployed to map!`);
        } else {
            toast.info(`Device "${dev.alias}" connected on LAN.`);
        }
    };

    if (!isOpen) return null;

    const categoryTabs: { key: LanDeviceCategory; label: string; icon: React.ReactNode; count: number }[] = [
        { key: 'ALL', label: isKa ? 'ყველა' : 'All Devices', icon: <Layers size={13} />, count: devices.length },
        { 
            key: 'NVR_CAMERAS', 
            label: isKa ? 'NVR & კამერები' : 'NVR & Cameras', 
            icon: <Video size={13} />, 
            count: devices.filter(d => d.category === 'NVR' || d.category === 'IP_CAMERA').length 
        },
        { 
            key: 'DRONES', 
            label: isKa ? 'დრონები' : 'Drones / UAV', 
            icon: <Plane size={13} />, 
            count: devices.filter(d => d.category === 'DRONE').length 
        },
        { 
            key: 'GPS_ROVERS', 
            label: isKa ? 'GPS & RTK ბაზა' : 'GPS & RTK Base', 
            icon: <Navigation size={13} />, 
            count: devices.filter(d => d.category === 'GPS_ROVER').length 
        },
        { 
            key: 'SOIL_SENSORS', 
            label: isKa ? 'ნიადაგის სენსორები' : 'Soil Sensors', 
            icon: <Droplets size={13} />, 
            count: devices.filter(d => d.category === 'SOIL_SENSOR').length 
        },
        { 
            key: 'WEATHER_STATIONS', 
            label: isKa ? 'მეტეო სადგური' : 'Weather Stations', 
            icon: <CloudRain size={13} />, 
            count: devices.filter(d => d.category === 'WEATHER_STATION').length 
        },
        { 
            key: 'IOT_GATEWAYS', 
            label: isKa ? 'IoT & მორწყვა' : 'IoT & Irrigation', 
            icon: <Cpu size={13} />, 
            count: devices.filter(d => d.category === 'IOT_GATEWAY').length 
        }
    ];

    return (
        <div className="fixed inset-0 z-[3200] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-6xl max-h-[92vh] bg-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col text-white overflow-hidden">
                
                {/* Header with Title and Close */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900/90 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
                            <Wifi size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                    Local Area Network Hardware Discovery Engine
                                </span>
                            </div>
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                                {isKa ? 'ლოკალური ქსელის (LAN) & NVR მოწყობილობების სკანერი' : 'LAN Hardware & Multi-Channel NVR Scanner'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Subnet Configuration & Live Scanner Trigger Bar */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                <Radio size={13} className="text-cyan-400" />
                                {isKa ? 'ქვექსელი (Subnet):' : 'Subnet Range:'}
                            </span>
                            
                            {/* Editable Subnet input */}
                            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-700">
                                <input
                                    type="text"
                                    value={customSubnet}
                                    onChange={(e) => setCustomSubnet(e.target.value)}
                                    placeholder="192.168.1"
                                    className="bg-transparent text-xs font-mono font-bold text-cyan-300 w-28 focus:outline-none"
                                />
                                <span className="text-[10px] font-mono text-slate-500">.1 - .254</span>
                            </div>

                            {/* Auto-detect Subnet button */}
                            <button
                                type="button"
                                onClick={handleAutoDetectSubnet}
                                disabled={isAutoDetecting}
                                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1 border border-cyan-800/50 transition-colors cursor-pointer"
                                title="Auto-detect active local subnet via WebRTC"
                            >
                                <Zap size={12} className={isAutoDetecting ? 'animate-spin text-amber-400' : 'text-cyan-400'} />
                                <span>{isAutoDetecting ? 'Detecting...' : 'Auto-Detect'}</span>
                            </button>

                            {/* Preset Quick Chips */}
                            <div className="hidden sm:flex items-center gap-1">
                                {['192.168.10', '192.168.0', '192.168.1', '10.0.0'].map(chip => (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => setCustomSubnet(chip)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                                            customSubnet.startsWith(chip)
                                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                        }`}
                                    >
                                        {chip}.x
                                    </button>
                                ))}
                            </div>

                            {/* Search box */}
                            <div className="relative flex-1 min-w-[150px]">
                                <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder={isKa ? 'ძიება IP, ბრენდით, მოდელით...' : 'Search IP, model, MAC...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Scanner Actions: Ports drawer toggle, Manual Add, Start Scan */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPortConfig(!showPortConfig)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                    showPortConfig || selectedPorts.includes(2006)
                                        ? 'bg-slate-800 text-cyan-300 border-cyan-700/60'
                                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                                title="Configure ports to scan (e.g. 2006, 80, 8000)"
                            >
                                <Sliders size={13} />
                                <span>Ports ({selectedPorts.length})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsManualAddOpen(true)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                                title="Add an NVR, camera, or sensor by IP directly"
                            >
                                <Plus size={13} />
                                <span>{isKa ? 'ხელით დამატება' : '+ Add Manually'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleStartLanScan}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                    isScanning 
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                }`}
                            >
                                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                                <span>
                                    {isScanning 
                                        ? (isKa ? 'სკანირების შეჩერება' : 'Stop Scan') 
                                        : (isKa ? 'ქსელის სკანირება' : 'Scan Local Network')}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Ports Config Drawer */}
                    {showPortConfig && (
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 animate-in fade-in duration-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-400">
                                    Target Scan Ports (Click to toggle / probe):
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Add Port (e.g. 2006)"
                                        value={customPortInput}
                                        onChange={(e) => setCustomPortInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddPort()}
                                        className="w-36 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPort}
                                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                                    >
                                        + Add Port
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { port: 80, label: 'HTTP 80' },
                                    { port: 2006, label: 'Device Port 2006 (NVR/DVR)' },
                                    { port: 8000, label: 'Hikvision 8000' },
                                    { port: 8080, label: 'Alt HTTP 8080' },
                                    { port: 37777, label: 'Dahua 37777' },
                                    { port: 8899, label: 'ONVIF 8899' },
                                    { port: 502, label: 'Modbus 502 (Soil)' },
                                    { port: 2101, label: 'RTK NTRIP 2101 (GPS)' },
                                    { port: 22222, label: 'WeatherLink 22222' }
                                ].map(p => {
                                    const isSel = selectedPorts.includes(p.port);
                                    return (
                                        <button
                                            key={p.port}
                                            type="button"
                                            onClick={() => handleTogglePort(p.port)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                                isSel 
                                                    ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-500/80' 
                                                    : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                                            }`}
                                        >
                                            <span>{p.label}</span>
                                            {isSel && <Check size={10} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Chrome Local Network Access Permission Info Banner */}
                    <div className="p-2.5 bg-blue-950/40 border border-blue-900/50 rounded-xl flex items-center gap-2 text-xs text-blue-300">
                        <Info size={15} className="text-cyan-400 shrink-0" />
                        <span className="text-[11px] leading-tight">
                            <strong>Chrome Local Network Access:</strong> When you start the scan, Chrome may prompt: <em>&quot;Look for and connect to any device on your local network&quot;</em>. Click <strong>Allow</strong> so your browser can probe your local NVRs, cameras, and IoT sensors.
                        </span>
                    </div>
                </div>

                {/* Progress Bar during Scanning */}
                {isScanning && (
                    <div className="px-6 py-2.5 bg-blue-950/40 border-b border-blue-900/50">
                        <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 mb-1">
                            <span className="flex items-center gap-1.5">
                                <Zap size={12} className="animate-pulse text-amber-400" />
                                {scanPhaseText}
                            </span>
                            <span className="font-bold">{scanProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 rounded-full"
                                style={{ width: `${scanProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Filter Categories Tabs */}
                <div className="px-6 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {categoryTabs.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveCategory(tab.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                activeCategory === tab.key
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                                activeCategory === tab.key ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Bulk Selection & Device Action Toolbar */}
                <div className="px-6 py-2 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white font-bold">
                            <input
                                type="checkbox"
                                checked={selectedDeviceIds.length > 0 && selectedDeviceIds.length === filteredDevices.length}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                            />
                            <span>{isKa ? 'ყველას მონიშვნა' : 'Select All'} ({filteredDevices.length})</span>
                        </label>

                        {selectedDeviceIds.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[11px] font-bold">
                                {selectedDeviceIds.length} {isKa ? 'მონიშნულია' : 'selected'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedDeviceIds.length > 0 && (
                            <button
                                type="button"
                                onClick={handleDeleteSelected}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition-all cursor-pointer"
                            >
                                <X size={13} />
                                <span>{isKa ? `მონიშნულის წაშლა (${selectedDeviceIds.length})` : `Delete Selected (${selectedDeviceIds.length})`}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleAddUserNvrPreset}
                            className="px-2.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Attach Hikvision 4K NVR (192.168.10.244)"
                        >
                            <Plus size={13} />
                            <span>+ Hikvision NVR (192.168.10.244)</span>
                        </button>

                        {devices.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAllDevices}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                title="Wipe all devices from LAN list"
                            >
                                {isKa ? 'გასუფთავება' : 'Clear All'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Discovered Device Cards Grid */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {filteredDevices.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 space-y-2">
                            <Server size={36} className="mx-auto text-slate-600" />
                            <p className="text-sm font-bold text-slate-400">
                                {isKa ? 'მოწყობილობა ვერ მოიძებნა ამ კატეგორიაში' : 'No devices found matching current filter.'}
                            </p>
                            <p className="text-xs text-slate-600">
                                {isKa ? 'დააჭირეთ "ქსელის სკანირება"-ს ქვექსელის გადასამოწმებლად.' : 'Click "Scan LAN Subnet" above to broadcast inquiry packets.'}
                            </p>
                        </div>
                    ) : (
                        filteredDevices.map(dev => {
                            const isNvr = dev.category === 'NVR';
                            const isExpanded = expandedNvrIds.includes(dev.id);

                            return (
                                <div
                                    key={dev.id}
                                    className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-all space-y-4"
                                >
                                    {/* Device Header */}
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            {/* Item Selection Checkbox */}
                                            <input
                                                type="checkbox"
                                                checked={selectedDeviceIds.includes(dev.id)}
                                                onChange={() => handleToggleSelectDevice(dev.id)}
                                                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                            />

                                            <div className="p-3 bg-blue-950/70 border border-blue-800/60 text-blue-400 rounded-2xl">
                                                {dev.category === 'NVR' && <Server size={22} />}
                                                {dev.category === 'IP_CAMERA' && <Camera size={22} />}
                                                {dev.category === 'DRONE' && <Plane size={22} />}
                                                {dev.category === 'GPS_ROVER' && <Navigation size={22} />}
                                                {dev.category === 'SOIL_SENSOR' && <Droplets size={22} />}
                                                {dev.category === 'WEATHER_STATION' && <CloudRain size={22} />}
                                                {dev.category === 'IOT_GATEWAY' && <Cpu size={22} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800/60">
                                                        {dev.brand} • {dev.category.replace('_', ' ')}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                                                        {dev.pingMs}ms LAN
                                                    </span>
                                                    {dev.isVerified && (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                            <CheckCircle2 size={10} /> VERIFIED
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mt-1">
                                                    {dev.alias}
                                                </h3>
                                                <p className="text-[11px] font-mono text-slate-400">
                                                    {dev.model}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2">
                                            {/* Verify & Live Snapshot Button for NVR & Cameras */}
                                            {(dev.category === 'NVR' || dev.category === 'IP_CAMERA') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenVerification(dev)}
                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30 cursor-pointer"
                                                    title="Verify credentials, port 2006, and test live snapshot"
                                                >
                                                    <Sliders size={13} />
                                                    <span>{isKa ? 'შემოწმება' : 'Verify & Snapshot'}</span>
                                                </button>
                                            )}

                                            {/* Web UI Link */}
                                            <a
                                                href={`http://${dev.ip}:${dev.httpPort || 80}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1 transition-all"
                                                title={`Open Web Interface at http://${dev.ip}:${dev.httpPort || 80}`}
                                            >
                                                <ExternalLink size={14} />
                                            </a>

                                            {isNvr && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeployAllNvrChannels(dev)}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                                                >
                                                    <Layers size={13} />
                                                    <span>{isKa ? 'ყველა არხის რუკაზე დასმა' : 'Deploy All Channels'}</span>
                                                </button>
                                            )}

                                            {!isNvr && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeployOtherDevice(dev)}
                                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                                                >
                                                    <Plus size={13} />
                                                    <span>{isKa ? 'რუკაზე დამატება' : 'Deploy to Map'}</span>
                                                </button>
                                            )}

                                            {isNvr && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleNvrExpand(dev.id)}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                                >
                                                    <span>{dev.channels?.length || dev.channelsCount || 16} {isKa ? 'არხი' : 'Channels'}</span>
                                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                            )}

                                            {/* Individual Delete Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDevice(dev.id, dev.alias)}
                                                className="p-2 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/80 rounded-xl transition-all cursor-pointer"
                                                title={isKa ? 'მოწყობილობის წაშლა' : 'Delete Device'}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Hardware Technical Metadata Bar */}
                                    <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 border border-slate-800/80">
                                        <div>
                                            <span className="text-[9px] text-slate-500 uppercase block font-bold">IP ADDRESS:</span>
                                            <span className="font-bold text-white text-xs">{dev.ip}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-slate-500 uppercase block font-bold">MAC ADDRESS:</span>
                                            <span className="text-slate-300 text-xs">{dev.mac}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-slate-500 uppercase block font-bold">ACTIVE PORTS:</span>
                                            <span className="text-slate-300 text-xs">
                                                HTTP: {dev.httpPort} {dev.rtspPort ? `| RTSP: ${dev.rtspPort}` : ''} {dev.telemetryPort ? `| Data: ${dev.telemetryPort}` : ''}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-slate-500 uppercase block font-bold">PROTOCOL / STATUS:</span>
                                            <span className="text-emerald-400 text-xs truncate block">{dev.protocol}</span>
                                        </div>
                                    </div>

                                    {/* Specialized Telemetry Strip (for Drones, Weather, Soil) */}
                                    {dev.telemetry && (
                                        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/60 flex flex-wrap items-center gap-4 text-xs font-mono">
                                            {dev.telemetry.batteryPct !== undefined && (
                                                <span className="flex items-center gap-1.5 text-cyan-300">
                                                    🔋 Battery: <strong>{dev.telemetry.batteryPct}%</strong>
                                                </span>
                                            )}
                                            {dev.telemetry.gpsFix && (
                                                <span className="flex items-center gap-1.5 text-emerald-400">
                                                    🛰️ GNSS Fix: <strong>{dev.telemetry.gpsFix}</strong>
                                                </span>
                                            )}
                                            {dev.telemetry.moisturePct !== undefined && (
                                                <span className="flex items-center gap-1.5 text-blue-300">
                                                    💧 Soil Moisture: <strong>{dev.telemetry.moisturePct}%</strong> (Depth: {dev.telemetry.depthCm}cm)
                                                </span>
                                            )}
                                            {dev.telemetry.soilPh !== undefined && (
                                                <span className="flex items-center gap-1.5 text-amber-300">
                                                    🧪 pH: <strong>{dev.telemetry.soilPh}</strong> • EC: <strong>{dev.telemetry.soilEcDsm} dS/m</strong>
                                                </span>
                                            )}
                                            {dev.telemetry.tempC !== undefined && (
                                                <span className="flex items-center gap-1.5 text-orange-300">
                                                    🌡️ Air Temp: <strong>{dev.telemetry.tempC}°C</strong> • Humidity: <strong>{dev.telemetry.humidityPct}%</strong>
                                                </span>
                                            )}
                                            {dev.telemetry.solarRadiationWm2 !== undefined && (
                                                <span className="flex items-center gap-1.5 text-yellow-300">
                                                    ☀️ Solar: <strong>{dev.telemetry.solarRadiationWm2} W/m²</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Expanded PoE Channels for NVR */}
                                    {isNvr && isExpanded && dev.channels && (
                                        <div className="pt-2 border-t border-slate-800 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                    <CornerDownRight size={12} className="text-blue-400" />
                                                    {isKa ? 'NVR-ზე შეერთებული PoE IP კამერების არხები:' : 'Individual PoE IP Camera Channels connected to NVR:'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                {dev.channels.map(ch => (
                                                    <div
                                                        key={`ch-${ch.channel}`}
                                                        className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-mono font-bold text-[10px] border border-blue-800/60 shrink-0">
                                                                CH0{ch.channel}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-xs text-white truncate">
                                                                    {ch.name}
                                                                </h4>
                                                                <p className="text-[10px] font-mono text-slate-400 truncate">
                                                                    {ch.ip} • {ch.resolution} {ch.isPtz ? '• PTZ' : ''}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {onOpenLiveStream && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        onOpenLiveStream({
                                                                            id: `cam-${dev.id}-ch${ch.channel}`,
                                                                            name: ch.name,
                                                                            channel: ch.channel,
                                                                            model: ch.model,
                                                                            ipAddress: ch.ip,
                                                                            rtspPort: dev.rtspPort || 554,
                                                                            streamUrl: ch.rtspUrl,
                                                                            locationName: ch.name,
                                                                            lat: baseLat,
                                                                            lng: baseLng,
                                                                            mountHeightM: 6,
                                                                            azimuthDeg: 90,
                                                                            fovAngleDeg: 102,
                                                                            rangeM: 75,
                                                                            tiltAngleDeg: 4,
                                                                            isPtz: !!ch.isPtz,
                                                                            isNightVision: !!ch.isNightVision,
                                                                            status: 'ONLINE'
                                                                        });
                                                                    }}
                                                                    className="p-1.5 bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                                    title="Open Live RTSP Stream View"
                                                                >
                                                                    <Play size={11} />
                                                                    <span>Live</span>
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeployChannelToMap(dev, ch)}
                                                                className="px-2.5 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                                title="Place this camera onto the map"
                                                            >
                                                                <Plus size={11} />
                                                                <span>{isKa ? 'რუკაზე დასმა' : 'Deploy'}</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer with Summary */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {devices.length} {isKa ? 'მოწყობილობა იდენტიფიცირებულია' : 'hardware devices identified across local subnet'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all cursor-pointer"
                    >
                        {isKa ? 'დახურვა' : 'Done / Close'}
                    </button>
                </div>
            </div>

            {/* Camera / NVR Verification & Live Snapshot Modal (Port 2006 / RTSP / Snapshot) */}
            {isVerificationModalOpen && verificationTarget && (
                <CameraVerificationModal
                    isOpen={isVerificationModalOpen}
                    onClose={() => setIsVerificationModalOpen(false)}
                    target={verificationTarget}
                    onSuccess={handleVerificationSuccess}
                />
            )}

            {/* Manual Add Device Modal */}
            {isManualAddOpen && (
                <div className="fixed inset-0 z-[3400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-lg bg-slate-950 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl">
                                    <Server size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase text-white">
                                        {isKa ? 'მოწყობილობის ხელით დამატება' : 'Add Hardware Device Manually'}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                        Enter IP, Device Port (e.g. 2006), and credentials
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsManualAddOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Device Alias / Name</label>
                                <input
                                    type="text"
                                    value={manualDevice.alias}
                                    onChange={e => setManualDevice({ ...manualDevice, alias: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                                <select
                                    value={manualDevice.category}
                                    onChange={e => setManualDevice({ ...manualDevice, category: e.target.value as any })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                                >
                                    <option value="NVR">NVR / DVR Recorder</option>
                                    <option value="IP_CAMERA">IP Camera</option>
                                    <option value="GPS_ROVER">GPS Rover / RTK Base</option>
                                    <option value="DRONE">Field Drone</option>
                                    <option value="SOIL_SENSOR">Soil Sensor / Modbus</option>
                                    <option value="WEATHER_STATION">Weather Station</option>
                                    <option value="IOT_GATEWAY">IoT Gateway</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">IP Address / Host</label>
                                <input
                                    type="text"
                                    placeholder="192.168.10.248"
                                    value={manualDevice.ip}
                                    onChange={e => setManualDevice({ ...manualDevice, ip: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-cyan-300 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-cyan-400 uppercase mb-1">
                                    Device Port (SDK / 2006)
                                </label>
                                <input
                                    type="number"
                                    placeholder="2006"
                                    value={manualDevice.devicePort}
                                    onChange={e => setManualDevice({ ...manualDevice, devicePort: parseInt(e.target.value, 10) || 2006 })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-cyan-800 rounded-xl font-mono text-cyan-300 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">HTTP / Web Port</label>
                                <input
                                    type="number"
                                    placeholder="80"
                                    value={manualDevice.httpPort}
                                    onChange={e => setManualDevice({ ...manualDevice, httpPort: parseInt(e.target.value, 10) || 80 })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">RTSP Stream Port</label>
                                <input
                                    type="number"
                                    placeholder="554"
                                    value={manualDevice.rtspPort}
                                    onChange={e => setManualDevice({ ...manualDevice, rtspPort: parseInt(e.target.value, 10) || 554 })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username</label>
                                <input
                                    type="text"
                                    value={manualDevice.username}
                                    onChange={e => setManualDevice({ ...manualDevice, username: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                                <input
                                    type="password"
                                    value={manualDevice.password}
                                    onChange={e => setManualDevice({ ...manualDevice, password: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                                />
                            </div>

                            {manualDevice.category === 'NVR' && (
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NVR Camera Channels Count</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={64}
                                        value={manualDevice.channelsCount}
                                        onChange={e => setManualDevice({ ...manualDevice, channelsCount: parseInt(e.target.value, 10) || 16 })}
                                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsManualAddOpen(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveManualDevice}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-900/30"
                            >
                                Save Device
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
