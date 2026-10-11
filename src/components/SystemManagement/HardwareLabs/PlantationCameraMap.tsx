import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Layers, MapPin, 
    Compass, AlertTriangle, ShieldCheck, Maximize2, Sliders, Info,
    Satellite, Map as MapIcon, Crosshair, Plus, Trash2, Edit3, 
    Move, Check, X, Navigation, Radio, Video, ArrowRight
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import type { PlantationFeature } from '../../../types';
import type { PlantationCamera } from './CameraNvrLab';
import { DeviceControlPanel } from './DeviceControlPanel';
import { getMainPlantation, getPlantationsList, resolvePlantationCenter, CANONICAL_PLANTATION_NAME, CANONICAL_AGROBARI_CENTER } from '../../../utils/plantationHelper';
import { 
    computeFovConePolygon, 
    computeBlindZonePolygon, 
    computeBlindZoneDistanceM 
} from '../../../utils/cameraGeospatial';
import { getElevationAtCoords, getSlopeAndAspect } from '../../../utils/demTerrainViewshed';

export interface PlantationCameraMapProps {
    plantationFeatures: PlantationFeature[];
    cameras: PlantationCamera[];
    plannedCam: PlantationCamera;
    selectedCameraId?: string;
    onSelectCamera?: (cam: PlantationCamera) => void;
    onUpdatePlannedCamPosition?: (lat: number, lng: number) => void;
    onAddCameraAtPosition?: (lat: number, lng: number) => void;
    onUpdateCamera?: (cam: PlantationCamera) => void;
    onDeleteCamera?: (cameraId: string) => void;
    onToggleHideCamera?: (cameraId: string) => void;
    onAddPerimeterSetup?: () => void;
    hiddenCameraIds?: string[];
    mapCenter?: [number, number];
}

// Map Click Listener component for Leaflet
const MapClickHandler: React.FC<{
    onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
};

// Map Fly To Controller for Leaflet
const MapFlyToController: React.FC<{ target: [number, number] | null }> = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (
            target && 
            Array.isArray(target) && 
            Number.isFinite(target[0]) && 
            Number.isFinite(target[1]) &&
            target[0] >= -90 && target[0] <= 90 &&
            target[1] >= -180 && target[1] <= 180
        ) {
            try {
                const container = map.getContainer();
                if (container && container.clientWidth > 0 && container.clientHeight > 0) {
                    map.flyTo(target, 17, { animate: true, duration: 1.2 });
                } else {
                    map.setView(target, 17);
                }
            } catch {
                try {
                    map.setView(target, 17);
                } catch {}
            }
        }
    }, [target, map]);
    return null;
};

// Custom Leaflet Icons for Camera Poles with Directional Heading Arrow & Status
const createLeafletCameraIcon = (
    cam: PlantationCamera, 
    isPlanned: boolean = false, 
    isSelected: boolean = false,
    isHidden: boolean = false
) => {
    const color = isHidden ? '#64748b' : isPlanned ? '#3b82f6' : isSelected ? '#10b981' : '#6366f1';
    const border = isHidden ? '#475569' : isPlanned ? '#1d4ed8' : isSelected ? '#059669' : '#4338ca';
    const label = isPlanned ? 'PLAN' : `CH0${cam.channel}`;
    const heading = cam.azimuthDeg || 0;
    const opacity = isHidden ? '0.45' : '1';

    return L.divIcon({
        className: 'custom-camera-pole-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: grab; opacity: ${opacity};">
                <div style="
                    width: 28px; height: 28px; border-radius: 50%;
                    background: ${color}; border: 2.5px solid #ffffff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 11px; position: relative;
                ">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading}deg); transition: transform 0.2s;">
                        <polygon points="12 2 19 21 12 17 5 21 12 2" fill="white" />
                    </svg>
                    ${isHidden ? '<div style="position: absolute; top:-3px; right:-3px; background:#ef4444; width:10px; height:10px; border-radius:50%; border:1.5px solid white;"></div>' : ''}
                </div>
                <div style="
                    margin-top: 2px; background: rgba(15, 23, 42, 0.92);
                    color: #ffffff; font-size: 8px; font-weight: 800; font-family: monospace;
                    padding: 1.5px 5px; border-radius: 5px; border: 1px solid ${border};
                    white-space: nowrap; pointer-events: none;
                    display: flex; align-items: center; gap: 2px;
                ">
                    <span>${label}</span>
                    <span style="color:#94a3b8; font-size:7px;">${cam.tiltAngleDeg || 4}°</span>
                </div>
            </div>
        `,
        iconSize: [32, 44],
        iconAnchor: [16, 22]
    });
};

export const PlantationCameraMap: React.FC<PlantationCameraMapProps> = ({
    plantationFeatures = [],
    cameras = [],
    plannedCam,
    selectedCameraId,
    onSelectCamera,
    onUpdatePlannedCamPosition,
    onAddCameraAtPosition,
    onUpdateCamera,
    onDeleteCamera,
    onToggleHideCamera,
    onAddPerimeterSetup,
    hiddenCameraIds = [],
    mapCenter = [41.9023, 44.5]
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [viewMode, setViewMode] = useState<'real_satellite' | 'real_streets' | 'cad_vector'>('real_satellite');
    
    // Tool mode: select, add_camera, or move_camera
    const [toolMode, setToolMode] = useState<'select' | 'add_camera' | 'move_camera'>('select');

    // Zoom and Pan for SVG CAD mode
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Layer toggles
    const [showAllCones, setShowAllCones] = useState(true);
    const [showBlindZones, setShowBlindZones] = useState(true);
    const [showDoriBands, setShowDoriBands] = useState(true);
    const [showDirections, setShowDirections] = useState(true);
    const [showTrenches, setShowTrenches] = useState(true);
    const [showManagerDrawer, setShowManagerDrawer] = useState(true);

    // Camera Inline Edit State
    const [editingCamId, setEditingCamId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PlantationCamera>>({});

    // Smooth Fly Target
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
    const [showDeviceControl, setShowDeviceControl] = useState<boolean>(true);

    // Resolved Main Plantation Center & Info
    const resolvedPlantationCenter = useMemo(() => {
        return resolvePlantationCenter(plantationFeatures, mapCenter || [41.9023, 44.5]);
    }, [plantationFeatures, mapCenter]);

    const mainPlantation = useMemo(() => {
        return getMainPlantation(plantationFeatures, resolvedPlantationCenter);
    }, [plantationFeatures, resolvedPlantationCenter]);

    const plantationList = useMemo(() => {
        return getPlantationsList(plantationFeatures, resolvedPlantationCenter, false);
    }, [plantationFeatures, resolvedPlantationCenter]);

    const [selectedPlantationName, setSelectedPlantationName] = useState<string>(mainPlantation.name);

    const baseLat = resolvedPlantationCenter[0];
    const baseLng = resolvedPlantationCenter[1];

    // Collect all geo points from plantation features to calculate bounding box and center
    const allGeoPoints = useMemo<[number, number][]>(() => {
        const pts: [number, number][] = [];
        plantationFeatures.forEach(f => {
            if (Array.isArray(f.geometry)) {
                f.geometry.forEach((p: any) => {
                    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
                        pts.push([p[0], p[1]]);
                    }
                });
            }
        });

        // Also add cameras points to ensure they fit in view
        cameras.forEach(c => {
            if (c.lat && c.lng) pts.push([c.lat, c.lng]);
        });
        if (plannedCam.lat && plannedCam.lng) {
            pts.push([plannedCam.lat, plannedCam.lng]);
        }

        // Fallback default coordinates if no points exist
        if (pts.length === 0) {
            pts.push([baseLat - 0.003, baseLng - 0.004]);
            pts.push([baseLat + 0.003, baseLng + 0.004]);
            pts.push([baseLat - 0.002, baseLng + 0.003]);
            pts.push([baseLat + 0.002, baseLng - 0.003]);
        }

        return pts;
    }, [plantationFeatures, cameras, plannedCam, baseLat, baseLng]);

    const bounds = useMemo(() => {
        const lats = allGeoPoints.map(p => p[0]);
        const lngs = allGeoPoints.map(p => p[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const latMargin = Math.max(0.0008, (maxLat - minLat) * 0.15);
        const lngMargin = Math.max(0.0008, (maxLng - minLng) * 0.15);

        return {
            minLat: minLat - latMargin,
            maxLat: maxLat + latMargin,
            minLng: minLng - lngMargin,
            maxLng: maxLng + lngMargin,
            latSpan: Math.max(0.001, (maxLat - minLat) + 2 * latMargin),
            lngSpan: Math.max(0.001, (maxLng - minLng) + 2 * lngMargin),
            centerLat: (minLat + maxLat) / 2,
            centerLng: (minLng + maxLng) / 2
        };
    }, [allGeoPoints]);

    // Active Center
    const activeMapCenter = useMemo<[number, number]>(() => {
        if (plannedCam.lat && plannedCam.lng) {
            return [plannedCam.lat, plannedCam.lng];
        }
        return [bounds.centerLat, bounds.centerLng];
    }, [plannedCam.lat, plannedCam.lng, bounds.centerLat, bounds.centerLng]);

    // Project [lat, lng] to SVG canvas (width=640, height=440)
    const SVG_WIDTH = 640;
    const SVG_HEIGHT = 440;
    const PADDING = 30;

    const projectToSvg = (lat: number, lng: number): [number, number] => {
        const normX = (lng - bounds.minLng) / bounds.lngSpan;
        const normY = (lat - bounds.minLat) / bounds.latSpan;
        const x = PADDING + normX * (SVG_WIDTH - 2 * PADDING);
        const y = (SVG_HEIGHT - PADDING) - normY * (SVG_HEIGHT - 2 * PADDING);
        return [x, y];
    };

    const unprojectFromSvg = (svgX: number, svgY: number): [number, number] => {
        const normX = Math.max(0, Math.min(1, (svgX - PADDING) / (SVG_WIDTH - 2 * PADDING)));
        const normY = Math.max(0, Math.min(1, ((SVG_HEIGHT - PADDING) - svgY) / (SVG_HEIGHT - 2 * PADDING)));
        const lng = bounds.minLng + normX * bounds.lngSpan;
        const lat = bounds.minLat + normY * bounds.latSpan;
        return [lat, lng];
    };

    const metersToSvgPixels = useMemo(() => {
        const totalMetersLat = bounds.latSpan * 111111;
        const usableHeightPx = SVG_HEIGHT - 2 * PADDING;
        return usableHeightPx / Math.max(10, totalMetersLat);
    }, [bounds.latSpan]);

    // Handle map click for both Leaflet and SVG CAD mode
    const handleMapClickPosition = (lat: number, lng: number) => {
        if (toolMode === 'add_camera') {
            if (onAddCameraAtPosition) {
                onAddCameraAtPosition(lat, lng);
            } else if (onUpdatePlannedCamPosition) {
                onUpdatePlannedCamPosition(lat, lng);
                toast.success(`Planned camera placed at [${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
            }
            setToolMode('select');
        } else if (toolMode === 'move_camera') {
            const activeCam = cameras.find(c => c.id === selectedCameraId) || (plannedCam.id === selectedCameraId ? plannedCam : null);
            if (activeCam && onUpdateCamera) {
                onUpdateCamera({ ...activeCam, lat, lng });
                toast.success(`Camera "${activeCam.name}" relocated to [${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
            } else if (onUpdatePlannedCamPosition) {
                onUpdatePlannedCamPosition(lat, lng);
                toast.success(`Camera relocated to [${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
            }
            setToolMode('select');
        } else {
            // In select mode, clicking empty map updates planned position as fallback
            if (onUpdatePlannedCamPosition) {
                onUpdatePlannedCamPosition(lat, lng);
            }
        }
    };

    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const clickX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
        const clickY = (e.clientY - rect.top - panOffset.y) / zoomLevel;
        const [newLat, newLng] = unprojectFromSvg(clickX, clickY);
        handleMapClickPosition(newLat, newLng);
    };

    // Calculate blind zone distance in meters based on Mount Height and Tilt Angle: 4 deg default
    const computeBlindZoneM = (cam: PlantationCamera) => {
        return computeBlindZoneDistanceM(cam.mountHeightM, cam.tiltAngleDeg || 4, cam.fovAngleDeg || 90);
    };

    // Helper to generate SVG Path for camera FOV Cone with optional Blind Zone exclusion
    const renderCameraFovCone = (cam: PlantationCamera, isPlanned: boolean = false) => {
        const isHidden = hiddenCameraIds.includes(cam.id);
        if (isHidden) return null;

        const [cx, cy] = projectToSvg(cam.lat, cam.lng);
        const rangePx = Math.max(15, cam.rangeM * metersToSvgPixels);
        const blindM = computeBlindZoneM(cam);
        const blindPx = Math.max(4, blindM * metersToSvgPixels);

        const azimuth = cam.azimuthDeg || 0;
        const fov = cam.fovAngleDeg || 90;

        const startDeg = azimuth - fov / 2 - 90;
        const endDeg = azimuth + fov / 2 - 90;
        const startRad = (startDeg * Math.PI) / 180;
        const endRad = (endDeg * Math.PI) / 180;

        const largeArcFlag = fov > 180 ? 1 : 0;

        const x1 = cx + rangePx * Math.cos(startRad);
        const y1 = cy + rangePx * Math.sin(startRad);
        const x2 = cx + rangePx * Math.cos(endRad);
        const y2 = cy + rangePx * Math.sin(endRad);

        const bx1 = cx + blindPx * Math.cos(startRad);
        const by1 = cy + blindPx * Math.sin(startRad);
        const bx2 = cx + blindPx * Math.cos(endRad);
        const by2 = cy + blindPx * Math.sin(endRad);

        const fullWedgePath = `M ${cx} ${cy} L ${x1} ${y1} A ${rangePx} ${rangePx} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        const blindWedgePath = `M ${cx} ${cy} L ${bx1} ${by1} A ${blindPx} ${blindPx} 0 ${largeArcFlag} 1 ${bx2} ${by2} Z`;

        const isSel = selectedCameraId === cam.id;
        const coneColor = isPlanned ? '#3b82f6' : isSel ? '#10b981' : '#6366f1';

        return (
            <g key={`svg-cone-${cam.id}`} className="cursor-pointer" onClick={() => onSelectCamera?.(cam)}>
                {/* Full FOV Wedge */}
                <path
                    d={fullWedgePath}
                    fill={coneColor}
                    fillOpacity={isSel ? 0.32 : 0.18}
                    stroke={coneColor}
                    strokeWidth={isSel ? 2 : 1.2}
                    strokeDasharray={isSel ? 'none' : '4 2'}
                />

                {/* Red Blind Zone Wedge (Nadir Blind Arc beneath pole) */}
                {showBlindZones && (
                    <path
                        d={blindWedgePath}
                        fill="#ef4444"
                        fillOpacity={0.45}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                    />
                )}

                {/* Camera Center Pole Marker */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={isSel ? 7 : 5}
                    fill={coneColor}
                    stroke="#ffffff"
                    strokeWidth={2}
                />

                {/* Direction Pointer Needle */}
                {showDirections && (
                    <line
                        x1={cx}
                        y1={cy}
                        x2={cx + 18 * Math.cos((azimuth - 90) * Math.PI / 180)}
                        y2={cy + 18 * Math.sin((azimuth - 90) * Math.PI / 180)}
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                    />
                )}
            </g>
        );
    };

    const selectedCam = cameras.find(c => c.id === selectedCameraId) || (plannedCam.id === selectedCameraId ? plannedCam : null);

    // Save editing camera changes
    const handleSaveEditing = () => {
        if (!editingCamId || !onUpdateCamera) return;
        const existing = cameras.find(c => c.id === editingCamId);
        if (existing) {
            onUpdateCamera({
                ...existing,
                ...editForm
            });
            toast.success(`Camera "${editForm.name || existing.name}" updated.`);
        }
        setEditingCamId(null);
    };

    return (
        <div className="space-y-4">
            {/* TOP TOOLBAR: VIEW TOGGLES & INTERACTIVE CAMERA TOOLS */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
                {/* Tool Mode Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                        type="button"
                        onClick={() => setToolMode('select')}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            toolMode === 'select'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="Select & Inspect camera"
                    >
                        <Crosshair size={13} />
                        <span>Inspect</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setToolMode(toolMode === 'add_camera' ? 'select' : 'add_camera');
                            if (toolMode !== 'add_camera') {
                                toast.info('Click anywhere on the map to place a new camera.');
                            }
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            toolMode === 'add_camera'
                                ? 'bg-emerald-600 text-white shadow-md animate-pulse ring-2 ring-emerald-400/50'
                                : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
                        }`}
                        title="Click on the map to add camera"
                    >
                        <Plus size={13} className="stroke-[3]" />
                        <span>+ Add Camera on Map</span>
                    </button>

                    {selectedCam && (
                        <button
                            type="button"
                            onClick={() => {
                                setToolMode(toolMode === 'move_camera' ? 'select' : 'move_camera');
                                if (toolMode !== 'move_camera') {
                                    toast.info(`Click on the map to relocate "${selectedCam.name}" or drag its marker.`);
                                }
                            }}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                toolMode === 'move_camera'
                                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/50'
                                    : 'text-amber-400 hover:bg-amber-950/40'
                            }`}
                            title="Move / replace selected camera position"
                        >
                            <Move size={13} />
                            <span>Move Position</span>
                        </button>
                    )}
                </div>

                {/* View Mode (Satellite, Streets, CAD) */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                        type="button"
                        onClick={() => setViewMode('real_satellite')}
                        className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            viewMode === 'real_satellite' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Satellite size={13} />
                        <span>Satellite</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('real_streets')}
                        className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            viewMode === 'real_streets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <MapIcon size={13} />
                        <span>Streets</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('cad_vector')}
                        className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            viewMode === 'cad_vector' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Layers size={13} />
                        <span>CAD Vector</span>
                    </button>
                </div>

                {/* Layer Visibility Controls */}
                <div className="flex items-center gap-1.5">
                    {/* Active Profile Plantation & Sector Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-emerald-500/50 shadow-sm">
                        <span className="text-emerald-400 text-xs">🌿</span>
                        <select
                            value={selectedPlantationName || mainPlantation.name}
                            onChange={(e) => {
                                const targetName = e.target.value;
                                const item = plantationList.find(p => p.name === targetName) || mainPlantation;
                                setSelectedPlantationName(targetName);
                                setFlyTarget(item.center);
                                toast.success(`Flying map to: ${item.name}`);
                            }}
                            className="bg-transparent text-emerald-300 text-[10px] font-bold font-mono outline-none cursor-pointer max-w-[150px] truncate"
                            title="Choose plantation sector and fly map"
                        >
                            {plantationList.map((p, idx) => (
                                <option key={`cam-plant-${p.id}-${idx}`} value={p.name} className="bg-slate-950 text-slate-200">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                const item = plantationList.find(p => p.name === selectedPlantationName) || mainPlantation;
                                setFlyTarget(item.center);
                                toast.success(`Flying map to: ${item.name}`);
                            }}
                            className="p-0.5 hover:bg-emerald-900/60 rounded text-emerald-400 cursor-pointer transition-colors"
                            title="Fly to selected plantation"
                        >
                            <Navigation size={11} />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowBlindZones(!showBlindZones)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            showBlindZones ? 'bg-red-950/80 text-red-300 border border-red-500/50' : 'bg-slate-950 text-slate-500 border border-slate-800'
                        }`}
                        title="Toggle Blind Zone beneath pole (Slope shadow / nadir blind arc)"
                    >
                        <AlertTriangle size={12} /> Blind Sides
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowDirections(!showDirections)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            showDirections ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/50' : 'bg-slate-950 text-slate-500 border border-slate-800'
                        }`}
                        title="Toggle Direction Azimuth Arrows"
                    >
                        <Compass size={12} /> Directions
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowAllCones(!showAllCones)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            showAllCones ? 'bg-blue-950/80 text-blue-300 border border-blue-500/50' : 'bg-slate-950 text-slate-500 border border-slate-800'
                        }`}
                        title="Toggle All Camera Coverage Cones"
                    >
                        <Eye size={12} /> Cones
                    </button>

                    {onAddPerimeterSetup && (
                        <button
                            type="button"
                            onClick={onAddPerimeterSetup}
                            className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/40 flex items-center gap-1 cursor-pointer"
                            title="Deploy 4 perimeter cameras (N, S, E, W)"
                        >
                            <ShieldCheck size={12} /> 4-Perimeter
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setZoomLevel(1);
                            setPanOffset({ x: 0, y: 0 });
                        }}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                        title="Reset View"
                    >
                        <RotateCcw size={13} />
                    </button>
                </div>
            </div>

            {/* INTERACTIVE MODE NOTIFICATION BANNER */}
            {toolMode === 'add_camera' && (
                <div className="px-4 py-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-bold">
                            📹 ADD CAMERA MODE ACTIVE: Click anywhere on the map to place a new camera pole. Existing cameras, their headings, and red blind sides are displayed to help you eliminate blind spots.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setToolMode('select')}
                        className="p-1 text-emerald-400 hover:text-white rounded-lg hover:bg-emerald-900/60 cursor-pointer"
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            {toolMode === 'move_camera' && selectedCam && (
                <div className="px-4 py-2.5 bg-amber-950/80 border border-amber-500/50 rounded-2xl text-xs text-amber-200 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                        <Move size={14} className="text-amber-400 animate-bounce" />
                        <span className="font-bold">
                            📍 REPOSITION CAMERA: Click anywhere on the map to relocate "{selectedCam.name}". You can also drag the camera marker directly on the map.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setToolMode('select')}
                        className="p-1 text-amber-400 hover:text-white rounded-lg hover:bg-amber-900/60 cursor-pointer"
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* MAP CONTAINER AREA: REAL LEAFLET or VECTOR SVG */}
            {viewMode !== 'cad_vector' ? (
                /* REAL LEAFLET MAP (SATELLITE OR STREETS) */
                <div className="relative w-full h-[460px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    <MapContainer
                        center={activeMapCenter}
                        zoom={17}
                        maxZoom={20}
                        style={{ height: '100%', width: '100%', cursor: toolMode === 'add_camera' ? 'crosshair' : 'default' }}
                        attributionControl={false}
                    >
                        <MapClickHandler onMapClick={handleMapClickPosition} />
                        <MapFlyToController target={flyTarget} />

                        {viewMode === 'real_satellite' ? (
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                maxZoom={19}
                            />
                        ) : (
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                maxZoom={19}
                            />
                        )}

                        {/* Render Plantation Features (Drawn sectors, boundaries, trenches) */}
                        {plantationFeatures.map((f) => {
                            if (f.type === 'area' || f.type === 'boundary' || f.type === 'sector') {
                                const pts = (f.geometry || []) as [number, number][];
                                if (pts.length < 3) return null;
                                return (
                                    <Polygon
                                        key={f.id}
                                        positions={pts}
                                        pathOptions={{
                                            color: (f as any).strokeColor || '#22c55e',
                                            weight: 2,
                                            fillColor: (f as any).fillColor || '#22c55e',
                                            fillOpacity: 0.16
                                        }}
                                    >
                                        <Tooltip direction="top">{f.name || 'Plantation Sector'}</Tooltip>
                                    </Polygon>
                                );
                            }
                            if (f.type === 'line' || f.type === 'trench' || f.type === 'irrigation_line') {
                                const pts = (f.geometry || []) as [number, number][];
                                if (pts.length < 2) return null;
                                return (
                                    <Polyline
                                        key={f.id}
                                        positions={pts}
                                        pathOptions={{
                                            color: f.type === 'trench' ? '#f59e0b' : '#38bdf8',
                                            weight: 2.5,
                                            dashArray: f.type === 'trench' ? '4, 4' : undefined
                                        }}
                                    />
                                );
                            }
                            return null;
                        })}

                        {/* Render Existing Cameras FOV Cones on Real Map */}
                        {showAllCones && cameras.map((c) => {
                            if (!c.lat || !c.lng) return null;
                            const isHidden = hiddenCameraIds.includes(c.id);
                            if (isHidden) return null;

                            const fovPoly = computeFovConePolygon(c.lat, c.lng, c.azimuthDeg || 0, c.fovAngleDeg || 90, c.rangeM || 65);
                            const blindPoly = computeBlindZonePolygon({
                                centerLat: c.lat,
                                centerLng: c.lng,
                                azimuthDeg: c.azimuthDeg || 0,
                                fovAngleDeg: c.fovAngleDeg || 90,
                                rangeM: c.rangeM || 65,
                                mountHeightM: c.mountHeightM || 6,
                                tiltAngleDeg: c.tiltAngleDeg || 4
                            });
                            const isSel = selectedCameraId === c.id;

                            return (
                                <React.Fragment key={`cone-${c.id}`}>
                                    <Polygon
                                        positions={fovPoly}
                                        pathOptions={{
                                            color: isSel ? '#10b981' : '#6366f1',
                                            weight: isSel ? 2.5 : 1.2,
                                            dashArray: isSel ? undefined : '3, 3',
                                            fillColor: isSel ? '#10b981' : '#6366f1',
                                            fillOpacity: isSel ? 0.30 : 0.16
                                        }}
                                    />
                                    {showBlindZones && blindPoly.length > 2 && (
                                        <Polygon
                                            positions={blindPoly}
                                            pathOptions={{
                                                color: '#ef4444',
                                                weight: 1.5,
                                                dashArray: '2, 2',
                                                fillColor: '#ef4444',
                                                fillOpacity: 0.45
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Render Cameras Markers (Draggable for Move/Replace) */}
                        {cameras.map((c) => {
                            if (!c.lat || !c.lng) return null;
                            const isHidden = hiddenCameraIds.includes(c.id);
                            const isSel = selectedCameraId === c.id;

                            return (
                                <Marker
                                    key={`marker-${c.id}`}
                                    position={[c.lat, c.lng]}
                                    icon={createLeafletCameraIcon(c, false, isSel, isHidden)}
                                    draggable={true}
                                    eventHandlers={{
                                        click: () => onSelectCamera?.(c),
                                        dragend: (e) => {
                                            const marker = e.target;
                                            const pos = marker.getLatLng();
                                            if (onUpdateCamera) {
                                                onUpdateCamera({ ...c, lat: pos.lat, lng: pos.lng });
                                                toast.success(`Camera "${c.name}" dragged to [${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}]`);
                                            }
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" className="font-mono text-xs">
                                        [CH0{c.channel}] {c.name} • Heading {c.azimuthDeg || 0}° • Tilt {c.tiltAngleDeg || 4}° (Drag to move)
                                    </Tooltip>
                                </Marker>
                            );
                        })}

                        {/* Render Planned Camera with live Optical FOV Cone & Blind Zone Arc */}
                        {plannedCam.lat && plannedCam.lng && (
                            <React.Fragment>
                                <Polygon
                                    positions={computeFovConePolygon(
                                        plannedCam.lat, 
                                        plannedCam.lng, 
                                        plannedCam.azimuthDeg || 90, 
                                        plannedCam.fovAngleDeg || 105, 
                                        plannedCam.rangeM || 75
                                    )}
                                    pathOptions={{
                                        color: '#3b82f6',
                                        weight: 2.2,
                                        dashArray: '4, 4',
                                        fillColor: '#3b82f6',
                                        fillOpacity: 0.25
                                    }}
                                />

                                {showBlindZones && (
                                    <Polygon
                                        positions={computeBlindZonePolygon({
                                            centerLat: plannedCam.lat,
                                            centerLng: plannedCam.lng,
                                            azimuthDeg: plannedCam.azimuthDeg || 90,
                                            fovAngleDeg: plannedCam.fovAngleDeg || 105,
                                            rangeM: plannedCam.rangeM || 75,
                                            mountHeightM: plannedCam.mountHeightM || 6,
                                            tiltAngleDeg: plannedCam.tiltAngleDeg || 4
                                        })}
                                        pathOptions={{
                                            color: '#ef4444',
                                            weight: 1.5,
                                            dashArray: '2, 2',
                                            fillColor: '#ef4444',
                                            fillOpacity: 0.45
                                        }}
                                    />
                                )}

                                <Marker
                                    position={[plannedCam.lat, plannedCam.lng]}
                                    icon={createLeafletCameraIcon(plannedCam, true, true, false)}
                                    draggable={true}
                                    eventHandlers={{
                                        dragend: (e) => {
                                            const marker = e.target;
                                            const pos = marker.getLatLng();
                                            onUpdatePlannedCamPosition?.(pos.lat, pos.lng);
                                            toast.success(`Planned camera moved to [${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}]`);
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" permanent className="font-mono text-xs font-bold text-blue-400">
                                        📍 PLAN CAMERA (Drag to reposition)
                                    </Tooltip>
                                </Marker>
                            </React.Fragment>
                        )}
                    </MapContainer>
                </div>
            ) : (
                /* VECTOR CAD SVG MODE */
                <div 
                    className="relative w-full h-[460px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none"
                    style={{ cursor: toolMode === 'add_camera' ? 'crosshair' : 'default' }}
                    onMouseDown={(e) => {
                        if (e.button === 0 && e.shiftKey) {
                            setIsPanning(true);
                            setStartPan({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                        }
                    }}
                    onMouseMove={(e) => {
                        if (isPanning) {
                            setPanOffset({
                                x: e.clientX - startPan.x,
                                y: e.clientY - startPan.y
                            });
                        }
                    }}
                    onMouseUp={() => setIsPanning(false)}
                    onMouseLeave={() => setIsPanning(false)}
                >
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                        className="w-full h-full"
                        onClick={handleSvgClick}
                    >
                        <defs>
                            <pattern id="cam-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                            </pattern>
                        </defs>

                        <rect width="100%" height="100%" fill="url(#cam-grid)" />

                        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                            {plantationFeatures.map(f => {
                                if (f.type === 'area' || f.type === 'boundary' || f.type === 'sector') {
                                    const coords = (f.geometry || []) as [number, number][];
                                    if (coords.length < 3) return null;
                                    const ptsStr = coords.map(c => projectToSvg(c[0], c[1]).join(',')).join(' ');
                                    return (
                                        <polygon
                                            key={f.id}
                                            points={ptsStr}
                                            fill={(f as any).fillColor ? `${(f as any).fillColor}22` : 'rgba(34, 197, 94, 0.12)'}
                                            stroke={(f as any).strokeColor || '#22c55e'}
                                            strokeWidth="1.5"
                                        />
                                    );
                                }
                                if ((f.type === 'line' || f.type === 'trench' || f.type === 'irrigation_line') && showTrenches) {
                                    const coords = (f.geometry || []) as [number, number][];
                                    if (coords.length < 2) return null;
                                    const ptsStr = coords.map(c => projectToSvg(c[0], c[1]).join(',')).join(' ');
                                    return (
                                        <polyline
                                            key={f.id}
                                            points={ptsStr}
                                            fill="none"
                                            stroke={f.type === 'trench' ? '#f59e0b' : '#38bdf8'}
                                            strokeWidth="1.8"
                                            strokeDasharray={f.type === 'trench' ? '4 2' : 'none'}
                                        />
                                    );
                                }
                                return null;
                            })}

                            {showAllCones && cameras.map(cam => renderCameraFovCone(cam, false))}
                            {plannedCam.lat && plannedCam.lng && renderCameraFovCone(plannedCam, true)}
                        </g>
                    </svg>
                </div>
            )}

            {/* DOCKED SELECTED CAMERA ACTION CARD: HIDE, DELETE, EDIT, MOVE & PROPERTIES */}
            {selectedCam && (
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                <Video size={16} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-white uppercase">
                                        {selectedCam.name}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                                        CH0{selectedCam.channel}
                                    </span>
                                    {hiddenCameraIds.includes(selectedCam.id) && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-950 text-red-400 border border-red-800">
                                            HIDDEN
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    Model: {selectedCam.model} • GPS: [{selectedCam.lat.toFixed(5)}, {selectedCam.lng.toFixed(5)}]
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons for Selected Camera */}
                        <div className="flex items-center gap-2">
                            {/* Hide / Show Toggle */}
                            {onToggleHideCamera && (
                                <button
                                    type="button"
                                    onClick={() => onToggleHideCamera(selectedCam.id)}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                        hiddenCameraIds.includes(selectedCam.id)
                                            ? 'bg-red-950 text-red-300 border border-red-800 hover:bg-red-900'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    }`}
                                    title={hiddenCameraIds.includes(selectedCam.id) ? 'Show camera cone on map' : 'Hide camera cone from map'}
                                >
                                    {hiddenCameraIds.includes(selectedCam.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                                    <span>{hiddenCameraIds.includes(selectedCam.id) ? 'Unhide' : 'Hide'}</span>
                                </button>
                            )}

                            {/* Move / Reposition */}
                            <button
                                type="button"
                                onClick={() => {
                                    setToolMode('move_camera');
                                    toast.info(`Click anywhere on map to relocate "${selectedCam.name}" or drag its marker.`);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Move / replace position on map"
                            >
                                <Move size={13} />
                                <span>Move</span>
                            </button>

                            {/* Edit Properties */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (editingCamId === selectedCam.id) {
                                        setEditingCamId(null);
                                    } else {
                                        setEditingCamId(selectedCam.id);
                                        setEditForm({ ...selectedCam });
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                    editingCamId === selectedCam.id 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                                title="Edit camera parameters"
                            >
                                <Edit3 size={13} />
                                <span>{editingCamId === selectedCam.id ? 'Close' : 'Edit'}</span>
                            </button>

                            {/* Device Control & Move Panel Toggle */}
                            <button
                                type="button"
                                onClick={() => setShowDeviceControl(!showDeviceControl)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                    showDeviceControl 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-slate-800 hover:bg-slate-700 text-blue-300'
                                }`}
                                title="Open Device Control & Moving Panel"
                            >
                                <Move size={13} />
                                <span>{showDeviceControl ? 'Hide Controls' : 'Device Control & Move'}</span>
                            </button>

                            {/* Delete */}
                            {onDeleteCamera && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDeleteCamera(selectedCam.id);
                                        toast.success(`Camera "${selectedCam.name}" removed.`);
                                    }}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                    title="Delete camera"
                                >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Camera Specs & Calculated Blind Zone */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-[9px] uppercase text-slate-400 block">Mount Height</span>
                            <span className="text-white font-bold text-sm">{selectedCam.mountHeightM || 6} m AGL</span>
                        </div>
                        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-[9px] uppercase text-slate-400 block">Vertical Tilt</span>
                            <span className="text-amber-400 font-bold text-sm">{selectedCam.tiltAngleDeg || 4}° Pitch</span>
                        </div>
                        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-[9px] uppercase text-slate-400 block">Azimuth / FOV</span>
                            <span className="text-cyan-400 font-bold text-sm">{selectedCam.azimuthDeg || 0}° • {selectedCam.fovAngleDeg || 90}°</span>
                        </div>
                        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-[9px] uppercase text-slate-400 block">Blind Side Distance</span>
                            <span className="text-red-400 font-bold text-sm">&lt; {computeBlindZoneM(selectedCam)} m</span>
                        </div>
                    </div>

                    {/* Terrain Elevation & Slope ASL */}
                    <div className="px-3 py-2 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span>🏔️ <b>Ground Elevation:</b> <span className="text-emerald-400">{getElevationAtCoords(selectedCam.lat, selectedCam.lng, baseLat, baseLng).toFixed(1)}m ASL</span></span>
                            <span>•</span>
                            <span>📐 <b>Terrain Slope:</b> <span className="text-emerald-400">{getSlopeAndAspect(selectedCam.lat, selectedCam.lng, baseLat, baseLng).slopeDeg.toFixed(1)}°</span></span>
                        </div>
                        <div className="text-slate-500">
                            Pole Tip ASL: <span className="text-white">{(getElevationAtCoords(selectedCam.lat, selectedCam.lng, baseLat, baseLng) + (selectedCam.mountHeightM || 6)).toFixed(1)}m</span>
                        </div>
                    </div>

                    {/* DEVICE CONTROL & MOVING PANEL */}
                    {showDeviceControl && (
                        <div className="pt-1">
                            <DeviceControlPanel
                                camera={{
                                    id: selectedCam.id,
                                    name: selectedCam.name,
                                    channel: selectedCam.channel,
                                    model: selectedCam.model,
                                    ipAddress: selectedCam.ipAddress,
                                    lat: selectedCam.lat,
                                    lng: selectedCam.lng,
                                    azimuthDeg: selectedCam.azimuthDeg,
                                    tiltAngleDeg: selectedCam.tiltAngleDeg,
                                    opticalZoomX: (selectedCam as any).opticalZoomX || 2,
                                    rangeM: selectedCam.rangeM,
                                    mountHeightM: selectedCam.mountHeightM,
                                    isPtz: selectedCam.isPtz,
                                    isNightVision: selectedCam.isNightVision
                                }}
                                onUpdateCamera={(updated) => {
                                    const patched = { ...selectedCam, ...updated };
                                    if (onUpdateCamera) onUpdateCamera(patched);
                                    setEditForm(patched);
                                }}
                                onFlyToCoords={(coords, label) => {
                                    setFlyTarget(coords);
                                    if (label) toast.info(label);
                                }}
                                mapCenterCoords={[selectedCam.lat, selectedCam.lng]}
                                isKa={false}
                            />
                        </div>
                    )}

                    {/* INLINE PROPERTY EDIT FORM */}
                    {editingCamId === selectedCam.id && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-blue-500/40 space-y-3 text-xs">
                            <div className="font-bold text-white uppercase text-[11px] flex items-center justify-between">
                                <span>Edit Parameters: {selectedCam.name}</span>
                                <span className="text-blue-400 font-mono text-[10px]">Changes reflect live on map</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">Camera Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name || ''}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">Optic Model & Lens</label>
                                    <select
                                        value={editForm.model || ''}
                                        onChange={(e) => {
                                            const m = e.target.value;
                                            let fov = 90;
                                            let range = 75;
                                            if (m.includes('2.8mm')) { fov = 115; range = 45; }
                                            else if (m.includes('4mm')) { fov = 89; range = 75; }
                                            else if (m.includes('6mm')) { fov = 53; range = 110; }
                                            else if (m.includes('PTZ')) { fov = 60; range = 160; }
                                            setEditForm({ ...editForm, model: m, fovAngleDeg: fov, rangeM: range });
                                        }}
                                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs"
                                    >
                                        <option value="Hikvision DS-2CD2087G2-LU (4K ColorVu)">ColorVu 2.8mm (115° Ultra-Wide, 45m)</option>
                                        <option value="Hikvision DS-2CD2386G2-ISU (AcuSense 4K)">AcuSense 4mm (89° Orchard Rows, 75m)</option>
                                        <option value="Hikvision DS-2CD2T86G2-4I (6mm Telephoto)">Telephoto 6mm (53° Corridor, 110m)</option>
                                        <option value="Hikvision DS-2DE4425IW-DE (25x PTZ)">25x Optical PTZ (60° Perimeter, 160m)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sliders for Azimuth & Tilt */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                        <span className="text-slate-400">Azimuth Direction</span>
                                        <span className="text-cyan-400 font-bold font-mono">{editForm.azimuthDeg || 0}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        value={editForm.azimuthDeg || 0}
                                        onChange={(e) => setEditForm({ ...editForm, azimuthDeg: Number(e.target.value) })}
                                        className="w-full accent-cyan-500"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                        <span className="text-slate-400">Vertical Tilt Angle</span>
                                        <span className="text-amber-400 font-bold font-mono">{editForm.tiltAngleDeg ?? 4}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="45"
                                        value={editForm.tiltAngleDeg ?? 4}
                                        onChange={(e) => setEditForm({ ...editForm, tiltAngleDeg: Number(e.target.value) })}
                                        className="w-full accent-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">Pole Mount Height (m)</label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="25"
                                        value={editForm.mountHeightM || 6}
                                        onChange={(e) => setEditForm({ ...editForm, mountHeightM: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">Surveillance Range (m)</label>
                                    <input
                                        type="number"
                                        min="20"
                                        max="300"
                                        value={editForm.rangeM || 75}
                                        onChange={(e) => setEditForm({ ...editForm, rangeM: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingCamId(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveEditing}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md"
                                >
                                    <Check size={14} /> Save Changes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MULTI-CAMERA COVERAGE & FLEET MANAGER (MANAGE ALL TOGETHER) */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">
                            All Cameras Fleet Manager ({cameras.length - hiddenCameraIds.length} / {cameras.length} Active on Map)
                        </h4>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowManagerDrawer(!showManagerDrawer)}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                        {showManagerDrawer ? 'Collapse' : 'Expand All Cameras'}
                    </button>
                </div>

                {showManagerDrawer && (
                    <div className="space-y-2">
                        {cameras.length === 0 ? (
                            <p className="text-xs text-slate-500 py-3 text-center">
                                No cameras deployed yet. Click "+ Add Camera on Map" above or place planned camera.
                            </p>
                        ) : (
                            <div className="divide-y divide-slate-800/80">
                                {cameras.map((c) => {
                                    const isHidden = hiddenCameraIds.includes(c.id);
                                    const isSel = selectedCameraId === c.id;

                                    return (
                                        <div 
                                            key={`fleet-${c.id}`} 
                                            className={`py-2.5 px-3 rounded-xl transition-all flex flex-wrap items-center justify-between gap-3 ${
                                                isSel ? 'bg-blue-950/40 border border-blue-800/50' : 'hover:bg-slate-950/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleHideCamera?.(c.id)}
                                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                        isHidden 
                                                            ? 'bg-red-950/80 text-red-400 border border-red-800' 
                                                            : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                                                    }`}
                                                    title={isHidden ? 'Unhide on map' : 'Hide from map'}
                                                >
                                                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-xs cursor-pointer hover:text-blue-400" onClick={() => onSelectCamera?.(c)}>
                                                            {c.name}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-400">
                                                            CH0{c.channel}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                                                        <span>Direction: <b className="text-cyan-400">{c.azimuthDeg || 0}°</b></span>
                                                        <span>•</span>
                                                        <span>Tilt: <b className="text-amber-400">{c.tiltAngleDeg || 4}°</b></span>
                                                        <span>•</span>
                                                        <span>Range: {c.rangeM}m</span>
                                                        <span>•</span>
                                                        <span>Blind Zone: <b className="text-red-400">&lt; {computeBlindZoneM(c)}m</b></span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSelectCamera?.(c);
                                                        setToolMode('move_camera');
                                                        toast.info(`Click on map to relocate "${c.name}" or drag its marker.`);
                                                    }}
                                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg cursor-pointer"
                                                    title="Move camera"
                                                >
                                                    <Move size={13} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSelectCamera?.(c);
                                                        setEditingCamId(c.id);
                                                        setEditForm({ ...c });
                                                    }}
                                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg cursor-pointer"
                                                    title="Edit camera"
                                                >
                                                    <Edit3 size={13} />
                                                </button>

                                                {onDeleteCamera && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteCamera(c.id)}
                                                        className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg cursor-pointer"
                                                        title="Delete camera"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
