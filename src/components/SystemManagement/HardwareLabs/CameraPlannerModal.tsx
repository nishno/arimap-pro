import React, { useState, useMemo, useEffect } from 'react';
import { 
    X, Camera, Compass, Sliders, Check, AlertTriangle, ShieldCheck, 
    Eye, MapPin, Radio, Wifi, Video, ArrowRight, Info, Plus, 
    Trash2, Copy, ZoomIn, ZoomOut, Layers, Sparkles, Satellite,
    Map as MapIcon, RotateCcw, Maximize2, Server, HardDrive, 
    CheckCircle2, Navigation, ChevronDown, ExternalLink, Move
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { PlantationCamera } from './CameraNvrLab';
import { 
    computeFovConePolygon, 
    computeBlindZonePolygon, 
    computeBlindZoneDistanceM 
} from '../../../utils/cameraGeospatial';
import { Sandbox3DTerrainCanvas } from './Sandbox3DTerrainCanvas';
import { safeStorage } from '../../../services/storageService';
import type { PlantationFeature } from '../../../types';
import { Go2rtcVideoStream } from './Go2rtcVideoStream';
import { DeviceControlPanel } from './DeviceControlPanel';
import { getMainPlantation, getPlantationsList, resolvePlantationCenter, CANONICAL_PLANTATION_NAME, CANONICAL_AGROBARI_CENTER } from '../../../utils/plantationHelper';

export interface SavedNvrItem {
    id: string;
    alias: string;
    brand: 'Hikvision' | 'Dahua' | 'Uniview' | 'Axis' | 'Generic ONVIF';
    model: string;
    host: string;
    httpPort: number;
    rtspPort: number;
    channelsCount: number;
    username: string;
    password?: string;
    status: 'ONLINE' | 'OFFLINE';
}

export interface CameraPlannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCamera?: Partial<PlantationCamera>;
    onSaveCamera: (cam: PlantationCamera) => void;
    onSaveBatchCameras?: (cams: PlantationCamera[]) => void;
    plantationCoords?: [number, number];
    plantationFeatures?: PlantationFeature[];
    currentMapCameras?: PlantationCamera[];
    onDeleteCameraFromMap?: (id: string) => void;
    onClearAllCameras?: () => void;
    onOpenAllCamerasWide?: () => void;
}

interface PlannedCameraItem extends PlantationCamera {
    nvrId?: string;
    opticalZoomX: number;
    digitalZoomX: number;
    focalLengthMm: number;
    resolutionMp: number;
    pixelRadiusIdM: number;    // 250 PPM facial identification radius
    pixelRadiusRecM: number;   // 125 PPM recognition radius
    pixelRadiusObsM: number;   // 62 PPM observation radius
    pixelRadiusDetM: number;   // 25 PPM detection radius
}

const DEFAULT_NVRS: SavedNvrItem[] = [
    {
        id: 'nvr-hikvision-244',
        alias: 'Main Plantation Hikvision 4K NVR',
        brand: 'Hikvision',
        model: 'DS-7716NI-I4 / 16P (4K AcuSense)',
        host: '192.168.10.244',
        httpPort: 80,
        rtspPort: 554,
        channelsCount: 16,
        username: 'admin',
        password: '***',
        status: 'ONLINE'
    },
    {
        id: 'nvr-dahua-245',
        alias: 'Storage & Warehouse DVR / NVR',
        brand: 'Dahua',
        model: 'XVR5108HS-4KL-I3 (8 CH WizSense)',
        host: '192.168.10.245',
        httpPort: 80,
        rtspPort: 554,
        channelsCount: 8,
        username: 'admin',
        status: 'ONLINE'
    }
];

const CAMERA_PRESETS = [
    {
        model: 'Hikvision DS-2CD2087G2-LU (4K ColorVu 2.8mm)',
        resolutionMp: 8.3,
        focalLengthMm: 2.8,
        defaultFov: 102,
        defaultRange: 75,
        opticalZoom: 1,
        isPtz: false,
        desc: 'F1.0 Super-aperture 24/7 Full-Color Night Vision'
    },
    {
        model: 'Hikvision DS-2CD2386G2-ISU (AcuSense 4K 4.0mm)',
        resolutionMp: 8.3,
        focalLengthMm: 4.0,
        defaultFov: 89,
        defaultRange: 90,
        opticalZoom: 1,
        isPtz: false,
        desc: 'Deep learning human/vehicle classification AI'
    },
    {
        model: 'Hikvision DS-2DE4425IW-DE (25x PTZ DarkFighter)',
        resolutionMp: 4.0,
        focalLengthMm: 4.8,
        defaultFov: 65,
        defaultRange: 160,
        opticalZoom: 25,
        isPtz: true,
        desc: '25x Optical Zoom Motorized Pan-Tilt-Zoom with IR 100m'
    },
    {
        model: 'Hikvision DarkFighter Ultra-LowLight (6.0mm)',
        resolutionMp: 5.0,
        focalLengthMm: 6.0,
        defaultFov: 54,
        defaultRange: 110,
        opticalZoom: 1,
        isPtz: false,
        desc: 'High sensitivity sensor for deep orchard rows'
    },
    {
        model: 'Hikvision DS-2DF8C442IXS (42x Laser PTZ 4K)',
        resolutionMp: 8.0,
        focalLengthMm: 6.0,
        defaultFov: 60,
        defaultRange: 280,
        opticalZoom: 42,
        isPtz: true,
        desc: 'Long-range laser perimeter tracking with 42x zoom'
    },
    {
        model: 'Dahua WizSense IPC-HFW3849T1-AS-PV (4K TiOC)',
        resolutionMp: 8.0,
        focalLengthMm: 2.8,
        defaultFov: 107,
        defaultRange: 80,
        opticalZoom: 1,
        isPtz: false,
        desc: 'Active deterrence with red/blue strobes & AI perimeter'
    },
    {
        model: 'Reolink RLC-811A (4K 5x Optical Zoom PoE/WiFi)',
        resolutionMp: 8.0,
        focalLengthMm: 2.7,
        defaultFov: 105,
        defaultRange: 85,
        opticalZoom: 5,
        isPtz: false,
        desc: '5x Optical zoom with person/vehicle spotlight'
    },
    {
        model: 'TP-Link Tapo C320WS (2K QHD Outdoor Wireless WiFi)',
        resolutionMp: 4.0,
        focalLengthMm: 3.18,
        defaultFov: 98,
        defaultRange: 60,
        opticalZoom: 1,
        isPtz: false,
        desc: 'Wireless outdoor WiFi camera with full color night vision'
    },
    {
        model: 'IMOU Cruiser 2 (3K 5MP Outdoor PTZ Wireless WiFi)',
        resolutionMp: 5.0,
        focalLengthMm: 3.6,
        defaultFov: 85,
        defaultRange: 70,
        opticalZoom: 1,
        isPtz: true,
        desc: 'Wireless 360-degree PTZ WiFi camera with smart tracking'
    },
    {
        model: 'Uniview Prime-I IPC2128SR3-DPF28 (4K Ultra HD)',
        resolutionMp: 8.0,
        focalLengthMm: 2.8,
        defaultFov: 112,
        defaultRange: 75,
        opticalZoom: 1,
        isPtz: false,
        desc: 'LightHunter technology for extreme low-light clarity'
    },
    {
        model: 'Generic ONVIF / Wireless Solar IP Camera (Custom)',
        resolutionMp: 4.0,
        focalLengthMm: 4.0,
        defaultFov: 88,
        defaultRange: 65,
        opticalZoom: 1,
        isPtz: false,
        desc: 'Universal RTSP/ONVIF profile S/T wireless online camera'
    }
];

function calculateDoriPixelRadii(
    resolutionWidthPx: number,
    hFovDeg: number,
    opticalZoom: number = 1
) {
    const effectiveHWidthPx = resolutionWidthPx * Math.min(16, Math.max(1, opticalZoom));
    const hFovRad = (hFovDeg * Math.PI) / 180;
    const tanHalf = Math.tan(hFovRad / 2);
    const radiusId = Math.round(effectiveHWidthPx / (2 * tanHalf * 250));
    const radiusRec = Math.round(effectiveHWidthPx / (2 * tanHalf * 125));
    const radiusObs = Math.round(effectiveHWidthPx / (2 * tanHalf * 62));
    const radiusDet = Math.round(effectiveHWidthPx / (2 * tanHalf * 25));

    return {
        idM: Math.max(5, radiusId),
        recM: Math.max(10, radiusRec),
        obsM: Math.max(20, radiusObs),
        detM: Math.max(40, radiusDet)
    };
}

// Leaflet Map Click Handler for Camera Relocation
const MapClickCameraPositioner: React.FC<{
    onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
};

// Leaflet FlyTo Controller
const MapFlyToController: React.FC<{ targetCoords: [number, number] | null }> = ({ targetCoords }) => {
    const map = useMap();
    useEffect(() => {
        if (
            targetCoords &&
            Array.isArray(targetCoords) &&
            typeof targetCoords[0] === 'number' &&
            typeof targetCoords[1] === 'number' &&
            Number.isFinite(targetCoords[0]) &&
            Number.isFinite(targetCoords[1]) &&
            targetCoords[0] >= -90 && targetCoords[0] <= 90 &&
            targetCoords[1] >= -180 && targetCoords[1] <= 180
        ) {
            try {
                const size = map.getSize ? map.getSize() : null;
                if (!size || size.x <= 10 || size.y <= 10) {
                    map.setView(targetCoords, 18);
                    return;
                }
                map.flyTo(targetCoords, 18, { duration: 1.2 });
            } catch {
                try {
                    map.setView(targetCoords, 18);
                } catch {}
            }
        }
    }, [targetCoords, map]);
    return null;
};

// Custom Leaflet Marker Icon
const createPlannerCameraIcon = (cam: PlannedCameraItem) => {
    return L.divIcon({
        className: 'custom-planner-cam-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: grab;">
                <div style="
                    width: 32px; height: 32px; border-radius: 50%;
                    background: #2563eb; border: 2.5px solid #ffffff;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 11px; position: relative;
                ">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${cam.azimuthDeg || 0}deg); transition: transform 0.2s;">
                        <polygon points="12 2 19 21 12 17 5 21 12 2" fill="white" />
                    </svg>
                </div>
                <div style="
                    margin-top: 2px; background: rgba(15, 23, 42, 0.95);
                    color: #ffffff; font-size: 9px; font-weight: 800; font-family: monospace;
                    padding: 2px 6px; border-radius: 6px; border: 1px solid #3b82f6;
                    white-space: nowrap; pointer-events: none;
                ">
                    CH0${cam.channel} • Tilt ${cam.tiltAngleDeg || 4}°
                </div>
            </div>
        `,
        iconSize: [36, 48],
        iconAnchor: [18, 24]
    });
};

const getFeatureCenter = (feature: any): [number, number] | null => {
    if (!feature) return null;
    if (feature.center && Array.isArray(feature.center)) {
        return [feature.center[0], feature.center[1]];
    }
    if (feature.geometry && feature.geometry.type === 'Polygon' && feature.geometry.coordinates?.[0]?.length) {
        const ring = feature.geometry.coordinates[0];
        let sumLat = 0, sumLng = 0;
        ring.forEach((pt: any) => {
            sumLat += pt[1];
            sumLng += pt[0];
        });
        return [sumLat / ring.length, sumLng / ring.length];
    }
    if (feature.coordinates && Array.isArray(feature.coordinates) && feature.coordinates.length) {
        let sumLat = 0, sumLng = 0;
        feature.coordinates.forEach((pt: any) => {
            if (Array.isArray(pt)) {
                sumLat += pt[0];
                sumLng += pt[1];
            }
        });
        return [sumLat / feature.coordinates.length, sumLng / feature.coordinates.length];
    }
    return null;
};

export const CameraPlannerModal: React.FC<CameraPlannerModalProps> = ({
    isOpen,
    onClose,
    initialCamera,
    onSaveCamera,
    onSaveBatchCameras,
    plantationCoords,
    plantationFeatures = [],
    currentMapCameras = [],
    onDeleteCameraFromMap,
    onClearAllCameras,
    onOpenAllCamerasWide
}) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';

    const resolvedCenter = useMemo(() => {
        return resolvePlantationCenter(plantationFeatures, plantationCoords || [41.9023, 44.5]);
    }, [plantationFeatures, plantationCoords]);

    const defaultLat = initialCamera?.lat || resolvedCenter[0];
    const defaultLng = initialCamera?.lng || resolvedCenter[1];

    // Main Plantation Info
    const mainPlantation = useMemo(() => {
        return getMainPlantation(plantationFeatures, resolvedCenter);
    }, [plantationFeatures, resolvedCenter]);

    // View mode for the embedded map window: Satellite vs Streets vs 3D Terrain DEM
    const [mapMode, setMapMode] = useState<'satellite' | 'streets' | '3d'>('satellite');

    // Right Column View Mode: 'specs' (Optical & DORI parameters) vs 'control' (Device Control & Moving) vs 'live' (Real-time Video Stream & PTZ)
    const [activeRightTab, setActiveRightTab] = useState<'specs' | 'control' | 'live'>('specs');

    // NVR Selection State - REQUIRED BEFORE CONFIGURING CAMERAS
    const [savedNvrs, setSavedNvrs] = useState<SavedNvrItem[]>(() => {
        const stored = safeStorage.getItem('agrimap_saved_nvrs');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (_) {}
        }
        return DEFAULT_NVRS;
    });

    // Currently selected NVR (defaults to user's Hikvision 192.168.10.244)
    const [selectedNvrId, setSelectedNvrId] = useState<string | null>(() => {
        return safeStorage.getItem('agrimap_selected_planner_nvr') || 'nvr-hikvision-244';
    });

    const activeNvr = useMemo(() => {
        return savedNvrs.find(n => n.id === selectedNvrId) || null;
    }, [savedNvrs, selectedNvrId]);

    const handleSelectNvr = (nvrId: string) => {
        setSelectedNvrId(nvrId);
        safeStorage.setItem('agrimap_selected_planner_nvr', nvrId);
        const nvr = savedNvrs.find(n => n.id === nvrId);
        if (nvr) {
            toast.success(isKa ? `NVR არჩეულია: ${nvr.alias} (${nvr.host})` : `NVR Selected: ${nvr.alias} (${nvr.host})`);
        }
    };

    // Plantation Dropdown & Map Fly State
    const [isPlantationDropdownOpen, setIsPlantationDropdownOpen] = useState(false);
    const [selectedPlantationLabel, setSelectedPlantationLabel] = useState<string>('');
    const [mapFlyTarget, setMapFlyTarget] = useState<[number, number] | null>(null);

    // Multi-camera state: can plan multiple cameras together
    const [camerasList, setCamerasList] = useState<PlannedCameraItem[]>(() => {
        const dori = calculateDoriPixelRadii(3840, 95, 1);
        const initialChannel = initialCamera?.channel || 1;
        const initialNvr = DEFAULT_NVRS[0];
        const firstCam: PlannedCameraItem = {
            id: initialCamera?.id || `cam-${Date.now()}`,
            name: initialCamera?.name || (isKa ? `სათვალთვალო კამერა #1 (ColorVu)` : `Surveillance Camera #1 (ColorVu)`),
            channel: initialChannel,
            model: initialCamera?.model || CAMERA_PRESETS[0].model,
            ipAddress: initialCamera?.ipAddress || initialNvr.host,
            rtspPort: initialCamera?.rtspPort || 554,
            locationName: initialCamera?.locationName || (isKa ? 'შესასვლელი ჭიშკარი & ასაწონი' : 'Main Gate & Weighing Scale'),
            lat: defaultLat,
            lng: defaultLng,
            azimuthDeg: initialCamera?.azimuthDeg ?? 45,
            fovAngleDeg: initialCamera?.fovAngleDeg ?? 95,
            rangeM: initialCamera?.rangeM ?? 75,
            mountHeightM: initialCamera?.mountHeightM ?? 6,
            tiltAngleDeg: initialCamera?.tiltAngleDeg ?? 4,
            isPtz: initialCamera?.isPtz ?? false,
            isNightVision: initialCamera?.isNightVision ?? true,
            status: 'ONLINE',
            opticalZoomX: 1,
            digitalZoomX: 1,
            focalLengthMm: 2.8,
            resolutionMp: 8.3,
            pixelRadiusIdM: dori.idM,
            pixelRadiusRecM: dori.recM,
            pixelRadiusObsM: dori.obsM,
            pixelRadiusDetM: dori.detM,
            nvrId: initialNvr.id
        };
        return [firstCam];
    });

    const [activeCamIndex, setActiveCamIndex] = useState<number>(0);
    const activeCam = camerasList[activeCamIndex] || camerasList[0];

    // Confirm Clear All Dialog State
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Effective plantation features for overlays & flyTo
    const effectiveFeatures = useMemo(() => {
        if (plantationFeatures && plantationFeatures.length > 0) return plantationFeatures;
        try {
            const rawDraft = safeStorage.getItem('agrimap_draft_features');
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}
        return [];
    }, [plantationFeatures]);

    // Available Plantations / Sectors for Quick Flying (Lists company's Main Plantation and all sectors)
    const plantationList = useMemo(() => {
        return getPlantationsList(effectiveFeatures, resolvedCenter, false);
    }, [effectiveFeatures, resolvedCenter]);

    // Handle Fly to Plantation / Sector
    const handleFlyToPlantation = (center: [number, number], name: string) => {
        setMapFlyTarget(center);
        setSelectedPlantationLabel(name);
        updateActiveCam({ lat: center[0], lng: center[1] });
        setIsPlantationDropdownOpen(false);
        toast.success(isKa ? `რუკა გადაფრინდა: ${name}` : `Flying map to: ${name}`);
    };

    if (!isOpen || !activeCam) return null;

    // Update active camera property helper
    const updateActiveCam = (fields: Partial<PlannedCameraItem>) => {
        setCamerasList(prev => {
            const copy = [...prev];
            const current = copy[activeCamIndex];
            const updated = { ...current, ...fields };

            if (fields.fovAngleDeg || fields.opticalZoomX || fields.resolutionMp || fields.model) {
                const widthPx = (updated.resolutionMp >= 8 ? 3840 : updated.resolutionMp >= 4 ? 2560 : 1920);
                const dori = calculateDoriPixelRadii(widthPx, updated.fovAngleDeg, updated.opticalZoomX);
                updated.pixelRadiusIdM = dori.idM;
                updated.pixelRadiusRecM = dori.recM;
                updated.pixelRadiusObsM = dori.obsM;
                updated.pixelRadiusDetM = dori.detM;
            }

            copy[activeCamIndex] = updated;
            return copy;
        });
    };

    // Add another camera to the batch (Only if NVR is selected)
    const handleAddAnotherCamera = () => {
        if (!selectedNvrId) {
            toast.warning(isKa ? 'გთხოვთ ჯერ აირჩიოთ NVR ჩამწერი' : 'Please select an NVR first');
            return;
        }

        const nextChannel = camerasList.length + 1;
        const offsetLat = defaultLat + (nextChannel * 0.0006);
        const offsetLng = defaultLng + (nextChannel * 0.0005);
        const dori = calculateDoriPixelRadii(3840, 90, 1);
        const nvrHost = activeNvr?.host || '192.168.10.244';

        const newCam: PlannedCameraItem = {
            id: `cam-${Date.now()}-${nextChannel}`,
            name: isKa ? `სათვალთვალო კამერა #${nextChannel}` : `Surveillance Camera #${nextChannel}`,
            channel: nextChannel,
            model: CAMERA_PRESETS[(nextChannel - 1) % CAMERA_PRESETS.length].model,
            ipAddress: nvrHost,
            rtspPort: 554,
            locationName: isKa ? `პერიმეტრის ბოძი #${nextChannel}` : `Perimeter Pole #${nextChannel}`,
            lat: offsetLat,
            lng: offsetLng,
            azimuthDeg: (nextChannel * 60) % 360,
            fovAngleDeg: 90,
            rangeM: 70,
            mountHeightM: 6,
            tiltAngleDeg: 4,
            isPtz: false,
            isNightVision: true,
            status: 'ONLINE',
            opticalZoomX: 1,
            digitalZoomX: 1,
            focalLengthMm: 4.0,
            resolutionMp: 8.3,
            pixelRadiusIdM: dori.idM,
            pixelRadiusRecM: dori.recM,
            pixelRadiusObsM: dori.obsM,
            pixelRadiusDetM: dori.detM,
            nvrId: selectedNvrId
        };

        setCamerasList(prev => [...prev, newCam]);
        setActiveCamIndex(camerasList.length);
        toast.info(isKa ? `კამერა #${nextChannel} დაემატა NVR არხზე CH0${nextChannel}` : `Camera #${nextChannel} assigned to NVR channel CH0${nextChannel}`);
    };

    // Remove camera from batch (one-by-one delete)
    const handleRemoveCamera = (indexToRemove: number) => {
        if (camerasList.length <= 1) {
            toast.warning(isKa ? 'მინიმუმ ერთი კამერა უნდა დარჩეს გეგმაში' : 'At least one camera must remain in plan');
            return;
        }
        const removed = camerasList[indexToRemove];
        setCamerasList(prev => prev.filter((_, idx) => idx !== indexToRemove));
        setActiveCamIndex(Math.max(0, indexToRemove - 1));
        toast.info(isKa ? `კამერა #${removed.channel} წაიშალა გეგმიდან` : `Camera #${removed.channel} deleted from plan`);
    };

    // Save active or all cameras
    const handleDeployAll = () => {
        if (!selectedNvrId) {
            toast.error(isKa ? 'გთხოვთ აირჩიოთ NVR ჩამწერი განთავსებამდე' : 'Please select an NVR before deploying');
            return;
        }
        if (onSaveBatchCameras) {
            onSaveBatchCameras(camerasList);
        } else {
            camerasList.forEach(c => onSaveCamera(c));
        }
        toast.success(
            isKa 
                ? `${camerasList.length} კამერა (NVR: ${activeNvr?.alias || 'DS-7716NI'}) განთავსდა რუკაზე!` 
                : `${camerasList.length} Cameras (NVR: ${activeNvr?.alias || 'DS-7716NI'}) deployed to map!`
        );
        onClose();
    };

    // Clear All Cameras from Map Action
    const handleConfirmClearAll = () => {
        if (onClearAllCameras) {
            onClearAllCameras();
        } else {
            safeStorage.removeItem('agrimap_plantation_cameras');
            toast.success(isKa ? 'ყველა კამერა წაიშალა რუკიდან' : 'All cameras cleared from map');
        }
        setShowClearConfirm(false);
    };

    // Optical Calculations
    const blindZoneM = computeBlindZoneDistanceM(activeCam.mountHeightM, activeCam.tiltAngleDeg, activeCam.fovAngleDeg);
    const groundCoverageM2 = Math.round(Math.PI * Math.pow(activeCam.rangeM, 2) * (activeCam.fovAngleDeg / 360));

    // Optical FOV cone coordinates for Leaflet
    const fovConePolygon = computeFovConePolygon(
        activeCam.lat, 
        activeCam.lng, 
        activeCam.azimuthDeg, 
        activeCam.fovAngleDeg, 
        activeCam.rangeM
    );

    // Blind zone circle beneath camera pole
    const blindZonePolygon = computeBlindZonePolygon({
        centerLat: activeCam.lat,
        centerLng: activeCam.lng,
        azimuthDeg: activeCam.azimuthDeg,
        fovAngleDeg: activeCam.fovAngleDeg,
        rangeM: activeCam.rangeM,
        mountHeightM: activeCam.mountHeightM,
        tiltAngleDeg: activeCam.tiltAngleDeg
    });

    return (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-600/20 border border-blue-500/40 rounded-2xl text-blue-400">
                                <Camera size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                        <Sparkles size={12} /> {isKa ? 'ოპტიკური გეგმარება & NVR ინტეგრაცია' : 'Optical Planner & NVR Integration'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 text-[10px] font-mono font-bold">
                                        {isKa ? `დახრა: ${activeCam.tiltAngleDeg}°` : `Tilt: ${activeCam.tiltAngleDeg}°`}
                                    </span>
                                </div>
                                <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                                    {isKa ? 'IP კამერის დამატება & NVR მართვა' : 'Add IP Camera & NVR Channel Manager'}
                                </h3>
                            </div>
                        </div>

                        {/* Top Action Buttons (Clear All Cameras & Close) */}
                        <div className="flex items-center gap-2">
                            {/* Clear All Cameras from Map Button */}
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(true)}
                                className="px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-700/60 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                title="Clear all cameras from the map"
                            >
                                <Trash2 size={13} className="text-red-400" />
                                <span className="hidden sm:inline">{isKa ? 'ყველა კამერის გასუფთავება' : 'Clear All Cameras'}</span>
                            </button>

                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* STEP 1: SELECT NVR RECORDER (REQUIRED BEFORE CAMERA MGMT) */}
                    {/* ========================================================= */}
                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${
                                selectedNvrId 
                                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400' 
                                    : 'bg-amber-600/20 border-amber-500/40 text-amber-400 animate-pulse'
                            }`}>
                                <Server size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                                        {isKa ? '1. NVR ჩამწერის შერჩევა (სავალდებულო)' : '1. Select NVR Recorder (Required)'}
                                    </span>
                                    {selectedNvrId && (
                                        <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[9px] font-bold flex items-center gap-1">
                                            <CheckCircle2 size={10} /> {isKa ? 'დაკავშირებულია' : 'Linked'}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs font-bold text-white truncate">
                                    {activeNvr ? `${activeNvr.alias} (${activeNvr.host}:${activeNvr.rtspPort})` : (isKa ? 'გთხოვთ აირჩიოთ NVR' : 'Please select an NVR')}
                                </div>
                            </div>
                        </div>

                        {/* NVR Dropdown Selector & Main Plantation Fly Button */}
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={selectedNvrId || ''}
                                onChange={(e) => handleSelectNvr(e.target.value)}
                                className="px-3 py-2 bg-slate-900 border border-blue-500/50 rounded-xl font-bold text-xs text-white outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="" disabled>{isKa ? '-- აირჩიეთ NVR --' : '-- Select NVR --'}</option>
                                {savedNvrs.map(nvr => (
                                    <option key={nvr.id} value={nvr.id}>
                                        {nvr.alias} [{nvr.host} • {nvr.channelsCount} CH]
                                    </option>
                                ))}
                            </select>

                            {/* Active Profile Plantation & Sector Selector */}
                            <div className="flex items-center gap-1.5 bg-slate-900 border border-emerald-500/50 rounded-xl px-2.5 py-1.5 shadow-sm">
                                <span className="text-emerald-400 text-xs">🌿</span>
                                <select
                                    value={selectedPlantationLabel || mainPlantation.name}
                                    onChange={(e) => {
                                        const chosen = plantationList.find(p => p.name === e.target.value) || mainPlantation;
                                        handleFlyToPlantation(chosen.center, chosen.name);
                                    }}
                                    className="bg-transparent text-emerald-300 text-xs font-bold font-mono outline-none cursor-pointer max-w-[190px] truncate"
                                    title={isKa ? 'პლანტაციის არჩევა და რუკის გადაფრენა' : 'Select plantation and fly map'}
                                >
                                    {plantationList.map((p, idx) => (
                                        <option key={`plan-p-${p.id}-${idx}`} value={p.name} className="bg-slate-950 text-slate-200">
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const chosen = plantationList.find(p => p.name === selectedPlantationLabel) || mainPlantation;
                                        handleFlyToPlantation(chosen.center, chosen.name);
                                    }}
                                    className="p-1 hover:bg-emerald-900/60 rounded text-emerald-400 cursor-pointer transition-colors"
                                    title={isKa ? 'გადაფრენა' : 'Fly to location'}
                                >
                                    <Navigation size={12} />
                                </button>
                            </div>

                            {/* Device Control Panel Quick Button */}
                            <button
                                type="button"
                                onClick={() => setActiveRightTab('control')}
                                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
                                    activeRightTab === 'control'
                                        ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                                        : 'bg-blue-950/80 hover:bg-blue-900 text-blue-200 border-blue-500/50'
                                }`}
                                title="Open Device Control Panel & Moving for active camera"
                            >
                                <Move size={13} className="text-cyan-400" />
                                <span>{isKa ? 'მართვა & გადატანა' : 'Device Control'}</span>
                            </button>

                            {selectedNvrId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        toast.info(isKa ? `NVR: ${activeNvr?.model} | IP: ${activeNvr?.host}:554 | 16 არხი` : `NVR: ${activeNvr?.model} | IP: ${activeNvr?.host}:554 | 16 Channels`);
                                    }}
                                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
                                    title="NVR Details"
                                >
                                    <Info size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Camera Switcher Tabs: Enabled ONLY AFTER NVR is Selected */}
                    <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar transition-opacity ${!selectedNvrId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        {camerasList.map((cam, idx) => {
                            const isSelected = idx === activeCamIndex;
                            return (
                                <button
                                    key={cam.id}
                                    type="button"
                                    onClick={() => setActiveCamIndex(idx)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                                        isSelected 
                                            ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40' 
                                            : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                                    }`}
                                >
                                    <Camera size={13} className={isSelected ? 'text-white' : 'text-blue-400'} />
                                    <span>[CH0${cam.channel}] {cam.name.slice(0, 16)}</span>
                                    {camerasList.length > 1 && (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveCamera(idx);
                                            }}
                                            className="hover:text-red-400 p-0.5 rounded-md hover:bg-slate-800"
                                            title="Delete this camera from plan (one by one)"
                                        >
                                            <Trash2 size={11} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {/* + Add Another Camera Button (Enabled after NVR select) */}
                        <button
                            type="button"
                            onClick={handleAddAnotherCamera}
                            disabled={!selectedNvrId}
                            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                            title="Add another camera on this NVR"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>{isKa ? '+ კამერის დამატება' : '+ Add Camera'}</span>
                        </button>

                        {/* Copy / Duplicate Active Camera */}
                        <button
                            type="button"
                            onClick={() => {
                                const nextChannel = camerasList.length + 1;
                                const copy: PlannedCameraItem = {
                                    ...activeCam,
                                    id: `cam-${Date.now()}-${nextChannel}`,
                                    name: `${activeCam.name} (Copy)`,
                                    channel: nextChannel,
                                    lat: activeCam.lat + 0.0004,
                                    lng: activeCam.lng + 0.0004,
                                    ipAddress: activeNvr?.host || '192.168.10.244'
                                };
                                setCamerasList(prev => [...prev, copy]);
                                setActiveCamIndex(camerasList.length);
                                toast.success(isKa ? `კამერის ასლი შეიქმნა: CH0${nextChannel}` : `Camera duplicated: CH0${nextChannel}`);
                            }}
                            disabled={!selectedNvrId}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/70 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                            title="Duplicate selected camera"
                        >
                            <Copy size={12} />
                            <span>{isKa ? 'ასლი' : 'Duplicate'}</span>
                        </button>

                        {/* Open Device Control Panel Next to Configuration */}
                        <button
                            type="button"
                            onClick={() => setActiveRightTab('control')}
                            disabled={!selectedNvrId}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
                                activeRightTab === 'control'
                                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                                    : 'bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border-blue-700/60'
                            } disabled:opacity-50`}
                            title="Open Device Control & Moving Panel"
                        >
                            <Sliders size={12} className="text-blue-400" />
                            <span>{isKa ? 'მართვა & გადაადგილება' : 'Device Control & Move'}</span>
                        </button>
                    </div>

                    {/* Cumulative Coverage Area Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] font-mono">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-slate-300 font-bold">
                                {isKa ? 'ჯამური ოპტიკური დაფარვა:' : 'Cumulative Optical Coverage:'}
                            </span>
                            <span className="text-emerald-400 font-bold">
                                {camerasList.length} {isKa ? 'კამერა' : 'Cameras'} &bull; ~{Math.round(camerasList.reduce((acc, c) => acc + Math.PI * Math.pow(c.rangeM, 2) * (c.fovAngleDeg / 360), 0) / 10000 * 100) / 100} ha
                            </span>
                        </div>
                        <span className="text-slate-400 text-[10px]">
                            {isKa ? '💡 გადაათრიეთ კამერის პინი რუკაზე ან გამოიყენეთ პლანტაციის ღილაკი' : '💡 Drag camera marker on map or use Plantation button to fly'}
                        </span>
                    </div>
                </div>

                {/* Main Body: 2 Columns (Map on Left/Top, Parameters on Right) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs text-slate-300 custom-scrollbar">
                    
                    {/* LEFT COLUMN: INTERACTIVE SATELLITE & 3D MAP WINDOW */}
                    <div className="lg:col-span-6 flex flex-col space-y-3">
                        
                        {/* Map Mode Selector Header + PLANTATION FLY-TO BUTTON */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setMapMode('satellite')}
                                    className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 transition-all cursor-pointer ${
                                        mapMode === 'satellite'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                                            : 'bg-slate-900 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Satellite size={12} />
                                    <span>{isKa ? '🛰️ სატელიტი' : 'Satellite'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMapMode('streets')}
                                    className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 transition-all cursor-pointer ${
                                        mapMode === 'streets'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                                            : 'bg-slate-900 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <MapIcon size={12} />
                                    <span>{isKa ? '🗺️ ქუჩები' : 'Streets'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMapMode('3d')}
                                    className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 transition-all cursor-pointer ${
                                        mapMode === '3d'
                                            ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/40'
                                            : 'bg-slate-900 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Layers size={12} />
                                    <span>{isKa ? '🏔️ 3D DEM' : '3D DEM'}</span>
                                </button>
                            </div>

                            {/* ======================================================== */}
                            {/* PLANTATION FLY-TO BUTTON & DROPDOWN (USER REQUEST POINT) */}
                            {/* ======================================================== */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsPlantationDropdownOpen(!isPlantationDropdownOpen)}
                                    className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/60 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
                                    title="Click to fly map directly to a selected plantation or sector"
                                >
                                    <Navigation size={12} className="text-emerald-400 shrink-0" />
                                    <span className="truncate max-w-[150px]">🌿 {selectedPlantationLabel || mainPlantation.name}</span>
                                    <ChevronDown size={11} className={`transition-transform ${isPlantationDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu for Flying to Selected Plantation & Sectors */}
                                {isPlantationDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150">
                                        <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                                {isKa ? 'პლანტაცია & სექტორები' : 'Plantation & Sectors'}
                                            </span>
                                            <span className="text-[9px] font-mono text-slate-400">{plantationList.length} zones</span>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                            {plantationList.map(plan => (
                                                <button
                                                    key={plan.id}
                                                    type="button"
                                                    onClick={() => handleFlyToPlantation(plan.center, plan.name)}
                                                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-emerald-950/60 text-slate-200 hover:text-white transition-all text-xs font-bold flex items-center justify-between cursor-pointer border border-transparent hover:border-emerald-600/30"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <MapPin size={13} className="text-emerald-400 shrink-0" />
                                                        <span className="truncate">{plan.name}</span>
                                                    </div>
                                                    {plan.areaHa && (
                                                        <span className="text-[10px] font-mono text-emerald-400 shrink-0 ml-1">
                                                            {plan.areaHa} ha
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Map Canvas Viewport Container */}
                        <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                            
                            {mapMode === '3d' ? (
                                /* 3D Terrain DEM Frustum View */
                                <div className="w-full h-full">
                                    <Sandbox3DTerrainCanvas
                                        plantationFeatures={effectiveFeatures}
                                        cameras={camerasList}
                                        selectedCameraId={activeCam.id}
                                        onSelectCamera={(c) => {
                                            const idx = camerasList.findIndex(x => x.id === c.id);
                                            if (idx >= 0) setActiveCamIndex(idx);
                                        }}
                                        droneMission={{
                                            name: 'Camera Survey Sandbox',
                                            mode: 'waypoints',
                                            waypoints: [],
                                            circleRadiusM: 60,
                                            altitudeM: 50,
                                            speedMs: 12,
                                            telemetryIntervalS: 2,
                                            directionDeg: 45,
                                            isSimulating: false,
                                            simulatedProgress: 0,
                                            currentLat: activeCam.lat,
                                            currentLng: activeCam.lng,
                                            currentAlt: 50,
                                            batteryPct: 98,
                                            plantationName: 'Main Plantation',
                                            sectorName: 'Camera Survey Area',
                                            selectedTrenches: [],
                                            isRecordingVideo: false,
                                            recordingSeconds: 0,
                                            opticalZoom: 1,
                                            gimbalPitchDeg: -45
                                        }}
                                        soilSensors={[]}
                                        waterSensors={[]}
                                        workersGps={[]}
                                        mapCenter={[activeCam.lat, activeCam.lng]}
                                        isKa={isKa}
                                        onSwitchTo2D={() => setMapMode('satellite')}
                                    />
                                </div>
                            ) : (
                                /* 2D Leaflet Satellite or Streets Map with Real FOV & DORI */
                                <MapContainer
                                    center={[activeCam.lat, activeCam.lng]}
                                    zoom={18}
                                    className="w-full h-full z-10"
                                    zoomControl={false}
                                >
                                    <TileLayer
                                        url={
                                            mapMode === 'satellite'
                                                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                                                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                                        }
                                        maxZoom={20}
                                    />

                                    {/* Fly To Controller for flying to selected plantation */}
                                    <MapFlyToController targetCoords={mapFlyTarget} />

                                    {/* Click Handler to reposition active camera pole */}
                                    <MapClickCameraPositioner
                                        onMapClick={(lat, lng) => {
                                            updateActiveCam({ lat, lng });
                                            toast.info(isKa ? `კამერა #${activeCam.channel} გადაადგილდა: ${lat.toFixed(6)}, ${lng.toFixed(6)}` : `Camera #${activeCam.channel} relocated: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                                        }}
                                    />

                                    {/* Multi-Camera Optical FOV Cones & Markers for all planned cameras */}
                                    {camerasList.map((cam, idx) => {
                                        const isSelected = idx === activeCamIndex;
                                        const fov = computeFovConePolygon(
                                            cam.lat,
                                            cam.lng,
                                            cam.azimuthDeg,
                                            cam.fovAngleDeg,
                                            cam.rangeM
                                        );
                                        const blind = computeBlindZonePolygon({
                                            centerLat: cam.lat,
                                            centerLng: cam.lng,
                                            azimuthDeg: cam.azimuthDeg,
                                            fovAngleDeg: cam.fovAngleDeg,
                                            rangeM: cam.rangeM,
                                            mountHeightM: cam.mountHeightM,
                                            tiltAngleDeg: cam.tiltAngleDeg
                                        });

                                        return (
                                            <React.Fragment key={cam.id}>
                                                {/* Optical Field of View (FOV) Cone */}
                                                {fov.length > 2 && (
                                                    <Polygon
                                                        positions={fov}
                                                        pathOptions={{
                                                            color: isSelected ? '#3b82f6' : '#10b981',
                                                            weight: isSelected ? 2.5 : 1.5,
                                                            dashArray: isSelected ? '4, 4' : '2, 2',
                                                            fillColor: isSelected ? '#3b82f6' : '#10b981',
                                                            fillOpacity: isSelected ? 0.28 : 0.14
                                                        }}
                                                    />
                                                )}

                                                {/* Blind Zone Circle */}
                                                {blind.length > 2 && (
                                                    <Polygon
                                                        positions={blind}
                                                        pathOptions={{
                                                            color: '#ef4444',
                                                            weight: 1.2,
                                                            dashArray: '2, 2',
                                                            fillColor: '#ef4444',
                                                            fillOpacity: 0.35
                                                        }}
                                                    />
                                                )}

                                                {/* Draggable Camera Pole Marker: click to select, drag to reposition */}
                                                <Marker
                                                    position={[cam.lat, cam.lng]}
                                                    icon={createPlannerCameraIcon(cam)}
                                                    draggable={true}
                                                    eventHandlers={{
                                                        click: () => {
                                                            setActiveCamIndex(idx);
                                                        },
                                                        dragend: (e) => {
                                                            const marker = e.target;
                                                            const pos = marker.getLatLng();
                                                            setCamerasList(prev => {
                                                                const next = [...prev];
                                                                next[idx] = { ...next[idx], lat: pos.lat, lng: pos.lng };
                                                                return next;
                                                            });
                                                            toast.success(
                                                                isKa 
                                                                    ? `კამერა #${cam.channel} გადაადგილდა: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` 
                                                                    : `Camera #${cam.channel} moved: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <Tooltip direction="top" permanent={isSelected}>
                                                        <span className="font-mono text-[9px] font-bold">
                                                            CH0${cam.channel}: {cam.name} ({cam.rangeM}m)
                                                        </span>
                                                    </Tooltip>
                                                </Marker>
                                            </React.Fragment>
                                        );
                                    })}
                                </MapContainer>
                            )}

                            {/* Floating Map Info Overlay */}
                            <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[10px] font-mono text-slate-300 pointer-events-none shadow-lg">
                                <div>Lat: {activeCam.lat.toFixed(6)} | Lng: {activeCam.lng.toFixed(6)}</div>
                                <div className="text-cyan-400">Azimuth: {activeCam.azimuthDeg}° | Tilt: {activeCam.tiltAngleDeg}° | Range: {activeCam.rangeM}m</div>
                            </div>
                        </div>

                        {/* Pixel Radius Breakdown Cards (DORI) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div className="p-2 bg-slate-950 rounded-xl border border-emerald-500/30 text-center">
                                <span className="text-[9px] uppercase font-black text-emerald-400 block">
                                    {isKa ? 'იდენტიფიკაცია' : 'Identification'}
                                </span>
                                <span className="text-xs font-black font-mono text-white mt-0.5 block">
                                    ~{activeCam.pixelRadiusIdM} მ
                                </span>
                                <span className="text-[8px] text-slate-400 block">250 PPM</span>
                            </div>

                            <div className="p-2 bg-slate-950 rounded-xl border border-blue-500/30 text-center">
                                <span className="text-[9px] uppercase font-black text-blue-400 block">
                                    {isKa ? 'ცნობა' : 'Recognition'}
                                </span>
                                <span className="text-xs font-black font-mono text-white mt-0.5 block">
                                    ~{activeCam.pixelRadiusRecM} მ
                                </span>
                                <span className="text-[8px] text-slate-400 block">125 PPM</span>
                            </div>

                            <div className="p-2 bg-slate-950 rounded-xl border border-indigo-500/30 text-center">
                                <span className="text-[9px] uppercase font-black text-indigo-400 block">
                                    {isKa ? 'დაკვირვება' : 'Observation'}
                                </span>
                                <span className="text-xs font-black font-mono text-white mt-0.5 block">
                                    ~{activeCam.pixelRadiusObsM} მ
                                </span>
                                <span className="text-[8px] text-slate-400 block">62 PPM</span>
                            </div>

                            <div className="p-2 bg-slate-950 rounded-xl border border-purple-500/30 text-center">
                                <span className="text-[9px] uppercase font-black text-purple-400 block">
                                    {isKa ? 'დეტექცია' : 'Detection'}
                                </span>
                                <span className="text-xs font-black font-mono text-white mt-0.5 block">
                                    ~{activeCam.pixelRadiusDetM} მ
                                </span>
                                <span className="text-[8px] text-slate-400 block">25 PPM</span>
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* DEPLOYED CAMERAS ON MAP (ONE BY ONE DELETION LIST) */}
                        {/* ======================================================== */}
                        {currentMapCameras.length > 0 && (
                            <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <Camera size={13} className="text-blue-400" />
                                        {isKa ? `რუკაზე განთავსებული კამერები (${currentMapCameras.length})` : `Deployed Cameras on Map (${currentMapCameras.length})`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowClearConfirm(true)}
                                        className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                                    >
                                        {isKa ? 'ყველას წაშლა' : 'Clear All'}
                                    </button>
                                </div>

                                <div className="max-h-32 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                    {currentMapCameras.map((mapCam) => (
                                        <div
                                            key={mapCam.id}
                                            className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-xs"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                <span className="font-bold text-white truncate max-w-[150px]">
                                                    {mapCam.name}
                                                </span>
                                                <span className="text-[10px] font-mono text-blue-400">
                                                    CH0{mapCam.channel}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setMapFlyTarget([mapCam.lat, mapCam.lng])}
                                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                    title="Fly to this camera"
                                                >
                                                    <Navigation size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onDeleteCameraFromMap) {
                                                            onDeleteCameraFromMap(mapCam.id);
                                                            toast.success(isKa ? `კამერა "${mapCam.name}" წაიშალა რუკიდან` : `Camera "${mapCam.name}" removed from map`);
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-red-950/80 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                                    title="Delete this camera from map (one by one)"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: CAMERA SPECIFICATIONS & OPTICAL PARAMETERS OR LIVE VIEW */}
                    <div className="lg:col-span-6 space-y-3">
                        
                        {/* Tab Switcher Header (Specs vs Live View Panel) */}
                        <div className="flex items-center justify-between p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveRightTab('specs')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                        activeRightTab === 'specs'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Sliders size={13} />
                                    <span>{isKa ? 'პარამეტრები' : 'Specs & Coverage'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveRightTab('control')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                        activeRightTab === 'control'
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/40'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Move size={13} />
                                    <span>{isKa ? 'მართვა & გადაადგილება' : 'Device Control & Move'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveRightTab('live')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                        activeRightTab === 'live'
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Video size={13} />
                                    <span>{isKa ? 'ლაივი' : 'Live View'}</span>
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                </button>
                            </div>

                            {onOpenAllCamerasWide && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenAllCamerasWide();
                                    }}
                                    className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1 transition-all cursor-pointer"
                                    title="Open 16-Channel Surveillance Matrix"
                                >
                                    <Maximize2 size={11} />
                                    <span>{isKa ? '16-არხიანი მატრიცა' : '16-Ch Matrix'}</span>
                                </button>
                            )}
                        </div>

                        {activeRightTab === 'live' ? (
                            /* ======================================================== */
                            /* LIVE VIEW PANEL: REAL-TIME STREAMING & CHANNEL SWITCHING */
                            /* ======================================================== */
                            <div className="space-y-3 animate-in fade-in duration-150">
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="font-bold text-xs text-white">
                                            Live Feed: [CH0{activeCam.channel < 10 ? `0${activeCam.channel}` : activeCam.channel}] {activeCam.name}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-emerald-400">
                                        {activeCam.ipAddress || '192.168.10.244'}:554
                                    </span>
                                </div>

                                {/* Embedded Go2rtc Live Stream */}
                                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black min-h-[300px]">
                                    <Go2rtcVideoStream
                                        streamSrc={`camera_${activeCam.channel}_main`}
                                        rtspUrl={`rtsp://CAMERA_HOST/${activeCam.ipAddress || '192.168.10.244'}:554/Streaming/Channels/${activeCam.channel}01`}
                                        cameraName={activeCam.name}
                                        channelNumber={activeCam.channel}
                                        aspectRatio="16/9"
                                    />
                                </div>

                                {/* Fast Channel Jumper for All Channels */}
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400">
                                            {isKa ? 'სწრაფი გადართვა არხებზე' : 'Fast Channel Switcher:'}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500">
                                            NVR: {activeNvr?.host || '192.168.10.244'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Array.from({ length: activeNvr?.channelsCount || 16 }).map((_, i) => {
                                            const ch = i + 1;
                                            const isCur = activeCam.channel === ch;
                                            return (
                                                <button
                                                    key={ch}
                                                    type="button"
                                                    onClick={() => {
                                                        updateActiveCam({
                                                            channel: ch,
                                                            name: `${activeCam.model.split(' ')[0]} CH0${ch < 10 ? `0${ch}` : ch}`
                                                        });
                                                    }}
                                                    className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                                                        isCur 
                                                            ? 'bg-blue-600 text-white shadow-md' 
                                                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                                    }`}
                                                >
                                                    CH0{ch < 10 ? `0${ch}` : ch}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : activeRightTab === 'control' ? (
                            /* ======================================================== */
                            /* DEVICE CONTROL & MOVING PANEL (PTZ + NUDGE + GEOGRAPHY)  */
                            /* ======================================================== */
                            <div className="space-y-3 animate-in fade-in duration-150">
                                <DeviceControlPanel
                                    camera={{
                                        id: activeCam.id,
                                        name: activeCam.name,
                                        channel: activeCam.channel,
                                        model: activeCam.model,
                                        ipAddress: activeCam.ipAddress,
                                        lat: activeCam.lat,
                                        lng: activeCam.lng,
                                        azimuthDeg: activeCam.azimuthDeg,
                                        tiltAngleDeg: activeCam.tiltAngleDeg,
                                        opticalZoomX: activeCam.opticalZoomX,
                                        digitalZoomX: activeCam.digitalZoomX,
                                        rangeM: activeCam.rangeM,
                                        mountHeightM: activeCam.mountHeightM,
                                        isPtz: activeCam.isPtz,
                                        isNightVision: activeCam.isNightVision
                                    }}
                                    onUpdateCamera={(updated) => updateActiveCam(updated)}
                                    onFlyToCoords={(coords, label) => {
                                        setMapFlyTarget(coords);
                                        if (label) toast.info(label);
                                    }}
                                    mapCenterCoords={[activeCam.lat, activeCam.lng]}
                                    isKa={isKa}
                                />
                            </div>
                        ) : (
                            /* ======================================================== */
                            /* OPTICAL PARAMETERS & HARDWARE SPECS                      */
                            /* ======================================================== */
                            <div className="space-y-4 animate-in fade-in duration-150">
                                {/* Device Identification & Hardware Model Selection */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'კამერის სახელი' : 'Camera Label / Name'}
                                        </label>
                                        <input
                                            type="text"
                                            value={activeCam.name}
                                            onChange={(e) => updateActiveCam({ name: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white focus:border-blue-500 outline-none text-xs"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                            {isKa ? 'NVR IP & არხი (Channel)' : 'NVR Host & Channel'}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={activeCam.ipAddress}
                                                onChange={(e) => updateActiveCam({ ipAddress: e.target.value })}
                                                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs outline-none focus:border-blue-500"
                                            />
                                            <select
                                                value={activeCam.channel}
                                                onChange={(e) => {
                                                    const ch = Number(e.target.value);
                                                    updateActiveCam({ 
                                                        channel: ch,
                                                        name: `${activeCam.model.split(' ')[0]} CH0${ch}`
                                                    });
                                                }}
                                                className="w-20 px-2 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center text-white text-xs font-bold outline-none cursor-pointer"
                                                title="NVR Channel"
                                            >
                                                {Array.from({ length: activeNvr?.channelsCount || 16 }).map((_, i) => (
                                                    <option key={i + 1} value={i + 1}>
                                                        CH {i + 1 < 10 ? `0${i + 1}` : i + 1}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                {isKa ? 'აპარატურული მოდელი & სპეციფიკაცია' : 'Hardware Model & Specs'}
                            </label>
                            <select
                                value={activeCam.model}
                                onChange={(e) => {
                                    const preset = CAMERA_PRESETS.find(p => p.model === e.target.value);
                                    if (preset) {
                                        updateActiveCam({
                                            model: preset.model,
                                            resolutionMp: preset.resolutionMp,
                                            focalLengthMm: preset.focalLengthMm,
                                            fovAngleDeg: preset.defaultFov,
                                            rangeM: preset.defaultRange,
                                            opticalZoomX: preset.opticalZoom,
                                            isPtz: preset.isPtz
                                        });
                                    } else {
                                        updateActiveCam({ model: e.target.value });
                                    }
                                }}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white focus:border-blue-500 outline-none text-xs"
                            >
                                {CAMERA_PRESETS.map(p => (
                                    <option key={p.model} value={p.model}>{p.model}</option>
                                ))}
                            </select>
                        </div>

                        {/* SLIDERS + DIRECT NUMBER INPUTS (WRITE NUMBER & SLIDE) */}
                        <div className="space-y-3.5 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                            
                            {/* Downward Tilt: Default 4 degrees with Slider and Number Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-[11px] text-slate-300 flex items-center gap-1.5">
                                        <Sliders size={13} className="text-amber-400" />
                                        {isKa ? 'დახრის კუთხე (Tilt - ნაგულისხმევი 4°)' : 'Downward Tilt Angle (Default 4°)'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="1"
                                            max="45"
                                            value={activeCam.tiltAngleDeg}
                                            onChange={(e) => updateActiveCam({ tiltAngleDeg: Number(e.target.value) })}
                                            className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-black text-right text-xs outline-none"
                                        />
                                        <span className="text-amber-400 text-xs font-mono font-bold">°</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="35"
                                    value={activeCam.tiltAngleDeg}
                                    onChange={(e) => updateActiveCam({ tiltAngleDeg: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>

                            {/* Azimuth / Direction with Slider and Number Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-[11px] text-slate-300 flex items-center gap-1.5">
                                        <Compass size={13} className="text-blue-400" />
                                        {isKa ? 'აზიმუტი (მიმართულება 0°–360°)' : 'Azimuth Direction (0°–360°)'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="0"
                                            max="359"
                                            value={activeCam.azimuthDeg}
                                            onChange={(e) => updateActiveCam({ azimuthDeg: Number(e.target.value) })}
                                            className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-blue-400 font-mono font-black text-right text-xs outline-none"
                                        />
                                        <span className="text-blue-400 text-xs font-mono font-bold">°</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="359"
                                    value={activeCam.azimuthDeg}
                                    onChange={(e) => updateActiveCam({ azimuthDeg: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            {/* Optical Range with Slider and Number Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-[11px] text-slate-300 flex items-center gap-1.5">
                                        <Eye size={13} className="text-emerald-400" />
                                        {isKa ? 'სათვალთვალო დისტანცია (მეტრი)' : 'Surveillance Range (Meters)'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="15"
                                            max="300"
                                            value={activeCam.rangeM}
                                            onChange={(e) => updateActiveCam({ rangeM: Number(e.target.value) })}
                                            className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-black text-right text-xs outline-none"
                                        />
                                        <span className="text-emerald-400 text-xs font-mono font-bold">მ</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="15"
                                    max="300"
                                    value={activeCam.rangeM}
                                    onChange={(e) => updateActiveCam({ rangeM: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>

                            {/* Mount Height with Slider and Number Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-[11px] text-slate-300 flex items-center gap-1.5">
                                        <MapPin size={13} className="text-purple-400" />
                                        {isKa ? 'სამონტაჟო ბოძის სიმაღლე (მეტრი)' : 'Mount Pole Height (Meters)'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="2"
                                            max="25"
                                            value={activeCam.mountHeightM}
                                            onChange={(e) => updateActiveCam({ mountHeightM: Number(e.target.value) })}
                                            className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-purple-400 font-mono font-black text-right text-xs outline-none"
                                        />
                                        <span className="text-purple-400 text-xs font-mono font-bold">მ</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="3"
                                    max="20"
                                    value={activeCam.mountHeightM}
                                    onChange={(e) => updateActiveCam({ mountHeightM: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            {/* Zoom Controls */}
                            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-slate-400">{isKa ? 'ოპტიკური ზუმი' : 'Optical Zoom'}</span>
                                        <span className="text-cyan-400 font-mono font-bold">{activeCam.opticalZoomX}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="32"
                                        value={activeCam.opticalZoomX}
                                        onChange={(e) => updateActiveCam({ opticalZoomX: Number(e.target.value) })}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-slate-400">{isKa ? 'ციფრული ზუმი' : 'Digital Zoom'}</span>
                                        <span className="text-cyan-400 font-mono font-bold">{activeCam.digitalZoomX}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="16"
                                        value={activeCam.digitalZoomX}
                                        onChange={(e) => updateActiveCam({ digitalZoomX: Number(e.target.value) })}
                                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

                {/* Footer with Deploy Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400 font-mono">
                        {isKa 
                            ? `გეგმაშია ${camerasList.length} კამერა • NVR: ${activeNvr?.alias || 'DS-7716NI'}` 
                            : `${camerasList.length} Cameras in Plan • NVR: ${activeNvr?.alias || 'DS-7716NI'}`}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                            {isKa ? 'გაუქმება' : 'Cancel'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                onSaveCamera(activeCam);
                                toast.success(isKa ? `კამერა "${activeCam.name}" შენახულია` : `Camera "${activeCam.name}" saved`);
                                onClose();
                            }}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                            {isKa ? 'ამ კამერის დამატება' : 'Deploy This Camera'}
                        </button>

                        <button
                            type="button"
                            onClick={handleDeployAll}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-95 transition-all"
                        >
                            <Check size={14} className="stroke-[3]" />
                            <span>
                                {isKa ? `ყველა კამერის განთავსება (${camerasList.length})` : `Deploy All Cameras (${camerasList.length})`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Clear All Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-red-500/50 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-red-400">
                            <div className="p-2.5 bg-red-950/80 rounded-xl border border-red-800/60">
                                <AlertTriangle size={22} />
                            </div>
                            <h4 className="font-black text-sm uppercase tracking-wide text-white">
                                {isKa ? 'ყველა კამერის გასუფთავება?' : 'Clear All Cameras from Map?'}
                            </h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            {isKa 
                                ? `დარწმუნებული ხართ, რომ გსურთ რუკიდან ყველა კამერის წაშლა? ეს მოქმედება წაშლის ყველა არსებულ კამერას (${currentMapCameras.length} ერთეული).` 
                                : `Are you sure you want to remove all cameras from the map? This will delete all ${currentMapCameras.length} deployed cameras.`}
                        </p>
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                {isKa ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmClearAll}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-red-950"
                            >
                                {isKa ? 'დიახ, გასუფთავება' : 'Yes, Clear All Cameras'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
