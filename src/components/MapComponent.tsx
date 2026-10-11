import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, Polyline, Tooltip, useMapEvents, Polygon, LayerGroup, CircleMarker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-editable';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import type { PlantationFeature, ActiveDrawingTool, FeatureType, Layer, AreaPlantationFeature, LinePlantationFeature, SeedlingPlantationFeature, SeedlingCondition, NotePlantationFeature, Template, User, OperationalLog, HarvestLog, Crop } from '../types';
import { isValidCoordinate } from '../types';
import { SearchIcon, XIcon, LeafIcon, TractorIcon, ChevronRightIcon, TagIcon, MapPinIcon } from './Icons';
import { GripHorizontal, PenTool } from 'lucide-react';
import { getSphericalPolygonArea, calculateLineLength } from '../services/geospatialService';
import type { LiveMapShowcase } from './FloatingCommunicationHub';
import { safeStorage } from '../services/storageService';
import type { PlantationCamera } from './SystemManagement/HardwareLabs/CameraNvrLab';
import type { DroneFlightMission } from './DroneFlightPathPlanner';
import { computeFovConePolygon, computeBlindZonePolygon, computeBlindZoneDistanceM } from '../utils/cameraGeospatial';

// Fix for default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const seedlingColors: { [key in SeedlingCondition]: string } = {
    'Good': '#10b981', // emerald-500
    'Suspicious': '#f59e0b', // amber-500
    'Dried': '#ef4444', // red-500
};

import '../lib/leafletSafety';
import { toSafeLatLngTuple, extractSafePoints, isValidCoordinatePair } from '../lib/leafletSafety';

const DEFAULT_MAP_COLOR = '#3388ff';
const EMPTY_ARRAY: any[] = [];

const isLatLngValid = (p: any): boolean => {
    return toSafeLatLngTuple(p) !== null;
};

const parseGeometry = (geometry: any): any => {
    if (!geometry) return [];
    // If it's a single point
    if (Array.isArray(geometry) && geometry.length === 2 && !Array.isArray(geometry[0]) && typeof geometry[0] !== 'object') {
        const pt = toSafeLatLngTuple(geometry);
        return pt ? pt : [];
    }
    if (typeof geometry === 'object' && geometry !== null && !Array.isArray(geometry)) {
        const pt = toSafeLatLngTuple(geometry);
        if (pt) return pt;
    }
    return extractSafePoints(geometry);
};

const extractAllFeatures = (featuresList: PlantationFeature[]): PlantationFeature[] => {
    const map = new Map<string, PlantationFeature>();
    
    const traverse = (item: any) => {
        if (!item || !item.id) return;
        if (!map.has(item.id)) {
            map.set(item.id, item);
        }
        if (Array.isArray(item.bundledLines)) {
            item.bundledLines.forEach((line: any) => {
                const enrichedLine = { 
                    ...line, 
                    parentId: line.parentId || item.id, 
                    layerId: line.layerId || item.layerId,
                    isVisible: line.isVisible !== false
                };
                traverse(enrichedLine);
            });
        }
        if (Array.isArray(item.bundledSeedlings)) {
            item.bundledSeedlings.forEach((seed: any) => {
                const enrichedSeed = { 
                    ...seed, 
                    parentId: seed.parentId || item.id, 
                    layerId: seed.layerId || item.layerId,
                    isVisible: seed.isVisible !== false
                };
                traverse(enrichedSeed);
            });
        }
    };
    
    featuresList.forEach(traverse);
    return Array.from(map.values());
};

const seedlingIconCache = new Map<string, L.DivIcon>();

const escapeHtml = (str: string): string => {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const createPencilSketchBadgeIcon = (feature: PlantationFeature, lineLength: number, isSelected: boolean) => {
    const hasComment = Boolean(feature.comment && feature.comment.trim());
    const isCommentVisible = feature.showCommentOnMap !== false;
    const sanitizedComment = feature.comment ? escapeHtml(feature.comment) : '';

    const html = `
        <div class="flex flex-col items-center select-none pointer-events-auto filter drop-shadow-xl" style="transform: translate(-50%, -50%);">
            <!-- Top Draft Pencil Badge -->
            <div 
                onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('agrimap:open-pencil-modal', { detail: { featureId: '${feature.id}' } }))"
                class="flex items-center gap-1.5 px-3 py-1 bg-white/95 hover:bg-white text-slate-900 border border-slate-300 rounded-full shadow-md text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all hover:scale-105 active:scale-95 ${isSelected ? 'ring-2 ring-blue-500 border-blue-400' : ''}"
                title="Pencil sketch (${lineLength.toFixed(1)}m) - Click to open conversion and comment options"
            >
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>✏️ DRAFT PENCIL</span>
                <span class="text-amber-600 font-mono font-black">${lineLength.toFixed(1)}M</span>
            </div>

            <!-- Below Draft Pencil: Comment & Toggle on / Remove -->
            ${hasComment ? `
                <div class="mt-1.5 flex flex-col items-center">
                    ${isCommentVisible ? `
                        <div class="bg-slate-950/95 backdrop-blur-xl border border-amber-400/90 text-white rounded-2xl px-3 py-2 shadow-2xl max-w-[260px] text-center animate-in fade-in zoom-in-95 duration-150">
                            <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1 text-[9px]">
                                <span class="text-amber-400 font-black flex items-center gap-1">
                                    <span>💬</span> <span>Comment</span>
                                </span>
                                <div class="flex items-center gap-1">
                                    <button 
                                        onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('agrimap:toggle-pencil-comment', { detail: { featureId: '${feature.id}' } }))"
                                        class="px-2 py-0.5 bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                                        title="Toggle comment off (hide on map)"
                                    >
                                        Toggle
                                    </button>
                                    <button 
                                        onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('agrimap:remove-pencil-comment', { detail: { featureId: '${feature.id}' } }))"
                                        class="px-1.5 py-0.5 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg text-[8px] font-black uppercase transition-colors cursor-pointer"
                                        title="Remove comment"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <p class="text-[11px] font-medium text-slate-100 leading-snug break-words">
                                ${sanitizedComment}
                            </p>
                        </div>
                    ` : `
                        <button 
                            onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('agrimap:toggle-pencil-comment', { detail: { featureId: '${feature.id}' } }))"
                            class="px-2.5 py-1 bg-slate-900/95 hover:bg-amber-600 text-amber-300 hover:text-white border border-slate-700/80 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg transition-all flex items-center gap-1 cursor-pointer"
                            title="Comment is hidden. Click to toggle on map"
                        >
                            <span>💬 Toggle Comment</span>
                        </button>
                    `}
                </div>
            ` : isSelected ? `
                <div class="mt-1">
                    <button 
                        onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('agrimap:open-pencil-modal', { detail: { featureId: '${feature.id}' } }))"
                        class="px-2 py-0.5 bg-slate-900/90 hover:bg-blue-600 text-slate-300 hover:text-white rounded-full text-[8px] font-bold shadow transition-colors cursor-pointer"
                    >
                        + Add Comment
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    return L.divIcon({
        className: 'bg-transparent border-none',
        html,
        iconSize: [280, 100],
        iconAnchor: [140, 20]
    });
};
const createSeedlingIcon = (condition: SeedlingCondition, isSelected: boolean) => {
    const key = `${condition}_${isSelected}`;
    let icon = seedlingIconCache.get(key);
    if (!icon) {
        icon = L.divIcon({
            html: `<div style="background-color: ${seedlingColors[condition] || '#a3a3a3'}; width: ${isSelected ? '20px' : '14px'}; height: ${isSelected ? '20px' : '14px'}; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: all 0.2s;"></div>`,
            className: 'seedling-marker-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
        seedlingIconCache.set(key, icon);
    }
    return icon;
};

export const getMarkerColorAndPriority = (feature: any) => {
    const isCompleted = (feature as any).status === 'completed';
    const rawPriority = String((feature as any).priority || (feature as any).importance || 'medium').toLowerCase();

    // Default color mapping by priority:
    // urgent -> crimson red (#dc2626)
    // high -> red (#ef4444)
    // medium -> amber yellow (#f59e0b)
    // low -> slate grey (#64748b)
    let defaultColor = '#f59e0b';
    if (rawPriority === 'urgent') defaultColor = '#dc2626';
    else if (rawPriority === 'high') defaultColor = '#ef4444';
    else if (rawPriority === 'low') defaultColor = '#64748b';

    // If custom color is explicitly set on feature (and not the legacy grey placeholder), honor it
    let finalColor = defaultColor;
    if (feature.customColor) {
        finalColor = feature.customColor;
    } else if (feature.color && feature.color !== '#a3a3a3' && feature.color !== '#cbd5e1') {
        finalColor = feature.color;
    }

    if (isCompleted) {
        return {
            color: '#10b981',
            isCompleted: true,
            priority: rawPriority,
            pulse: false
        };
    }

    const pulse = rawPriority === 'urgent' || rawPriority === 'high';
    return {
        color: finalColor,
        isCompleted: false,
        priority: rawPriority,
        pulse
    };
};

const createMonitoringIcon = (feature: NotePlantationFeature | any) => {
    const size = feature.iconSize || 30;
    const { color, isCompleted, pulse } = getMarkerColorAndPriority(feature);
    const opacity = isCompleted ? 0.8 : 1;

    // Pulse wave for High / Urgent importance markers
    const pulseRing = pulse
        ? `<div style="position: absolute; inset: -5px; border-radius: 50%; border: 2.5px solid ${color}; opacity: 0.8; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>`
        : '';

    const priorityPip = pulse
        ? `<div style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background-color: #ef4444; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.35);"></div>`
        : '';

    const html = `
        <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
            ${pulseRing}
            <div style="
                width: ${size}px; 
                height: ${size}px; 
                border-radius: 50%; 
                background-color: ${color}; 
                border: 2.5px solid #ffffff; 
                box-shadow: 0 3px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.15); 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                opacity: ${opacity};
                transition: all 0.2s ease;
                cursor: pointer;
            ">
                ${isCompleted ? `
                    <svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                ` : `
                    <div style="width: ${size * 0.35}px; height: ${size * 0.35}px; border-radius: 50%; background-color: #ffffff; opacity: 0.95;"></div>
                `}
            </div>
            ${priorityPip}
        </div>
    `;

    return L.divIcon({ 
        html, 
        className: 'agrimap-point-marker', 
        iconSize: [size, size], 
        iconAnchor: [size / 2, size / 2], 
        popupAnchor: [0, -size / 2 - 4] 
    });
};

const createMyLocationIcon = (isGps: boolean) => L.divIcon({
    html: isGps 
        ? `<div class="relative flex items-center justify-center" style="width: 24px; height: 24px;">
             <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
             <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-lg"></span>
           </div>`
        : `<div class="relative flex items-center justify-center animate-bounce" style="width: 32px; height: 32px;">
             <span class="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-20"></span>
             <svg class="w-6 h-6 text-rose-600 filter drop-shadow-md relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
           </div>`,
    className: 'custom-location-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const createGpsDeviceIcon = (dev: any) => {
    const isWorker = dev.type === 'worker_jacket';
    const isTractor = dev.type === 'vehicle_tractor';
    const isAlert = dev.status === 'GEOFENCE_ALERT';
    const isOnline = dev.status === 'ONLINE';
    const color = isAlert ? '#ef4444' : isWorker ? '#0284c7' : isTractor ? '#16a34a' : '#f59e0b';
    const iconGlyph = isWorker ? '🦺' : isTractor ? '🚜' : '🚛';
    const title = dev.assignedTo || dev.name;

    const html = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background: ${color}; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                ${iconGlyph}
                ${isOnline ? `
                    <div style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: #22c55e; border: 2px solid #ffffff;"></div>
                ` : ''}
            </div>
            <div style="margin-top: 3px; background: rgba(15, 23, 42, 0.9); color: #ffffff; padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 5px rgba(0,0,0,0.3); pointer-events: none;">
                ${title.split(' ')[0]} • ${dev.speedKmh} km/h
            </div>
        </div>
    `;

    return L.divIcon({
        html,
        className: 'agrimap-gps-device-marker',
        iconSize: [80, 56],
        iconAnchor: [40, 24],
        popupAnchor: [0, -28]
    });
};

const createCameraMarkerIcon = (cam: PlantationCamera, isSelected: boolean = false) => {
    const azimuth = cam.azimuthDeg || 0;
    const html = `
        <div class="relative flex items-center justify-center select-none" style="width: 38px; height: 38px; transform: translate(-50%, -50%);">
            <div class="absolute inset-0 rounded-full bg-blue-500/25 animate-ping pointer-events-none"></div>
            <div class="relative w-9 h-9 rounded-2xl bg-slate-950 border-2 ${isSelected ? 'border-emerald-400 shadow-emerald-500/50 scale-110' : 'border-blue-500 shadow-blue-500/40'} shadow-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? '#34d399' : '#60a5fa'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <div class="absolute -top-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-cyan-400" style="transform: rotate(${azimuth}deg) translateY(-8px);"></div>
            </div>
            <div class="absolute -bottom-2 px-1.5 py-0.2 bg-slate-950 text-white border border-slate-700 rounded font-mono text-[8px] font-black shadow pointer-events-none">
                CH0${cam.channel}
            </div>
        </div>
    `;
    return L.divIcon({
        className: 'agrimap-camera-marker',
        html,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -22]
    });
};

const createDroneWaypointIcon = (label: string, isHome: boolean = false, isReturn: boolean = false) => {
    const bg = isHome ? '#10b981' : isReturn ? '#f59e0b' : '#06b6d4';
    const html = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
            <div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${bg}; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-family: monospace; font-weight: 900; font-size: 10px; color: #ffffff;">
                ${label}
            </div>
        </div>
    `;
    return L.divIcon({
        className: 'agrimap-drone-waypoint-marker',
        html,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
    });
};

const createDroneFlightIcon = (headingDeg: number = 0) => {
    const html = `
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%) rotate(${headingDeg}deg); transition: transform 0.2s ease;">
            <div style="position: absolute; inset: -3px; border-radius: 50%; border: 2px dashed #06b6d4; animation: spin 4s linear infinite;"></div>
            <div style="width: 32px; height: 32px; border-radius: 10px; background-color: #0f172a; border: 2px solid #38bdf8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.7); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                </svg>
            </div>
        </div>
    `;
    return L.divIcon({
        className: 'agrimap-drone-flight-marker',
        html,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
    });
};

const MapUpdater: React.FC<{ center: [number, number]; zoom: number; hasBounds: boolean }> = ({ center, zoom, hasBounds }) => {
  const map = useMap();
  const lastPropsRef = useRef({ center: [center[0], center[1]] as [number, number], zoom });
  const isInteractingRef = useRef(false);

  useMapEvents({
    movestart() {
      isInteractingRef.current = true;
    },
    zoomstart() {
      isInteractingRef.current = true;
    },
    moveend() {
      isInteractingRef.current = false;
      const c = map.getCenter();
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        lastPropsRef.current.center = [c.lat, c.lng];
      }
    },
    zoomend() {
      isInteractingRef.current = false;
      const z = map.getZoom();
      if (Number.isFinite(z)) {
        lastPropsRef.current.zoom = z;
      }
    }
  });

  useEffect(() => {
    const lat = typeof center[0] === 'string' ? parseFloat(center[0]) : center[0];
    const lng = typeof center[1] === 'string' ? parseFloat(center[1]) : center[1];

    if (!isValidCoordinate([lat, lng]) || !Number.isFinite(zoom) || hasBounds) return;

    // Check if the target is significantly different from what we last applied or tracked
    const centerChanged = Math.abs(lastPropsRef.current.center[0] - lat) > 0.0005 || Math.abs(lastPropsRef.current.center[1] - lng) > 0.0005;
    const zoomChanged = Math.abs(lastPropsRef.current.zoom - zoom) > 0.5;

    if (centerChanged || zoomChanged) {
        lastPropsRef.current = { center: [lat, lng], zoom };
        try {
            const currentCenter = map.getCenter();
            const currentZoom = map.getZoom();
            const targetLatLng = L.latLng(lat, lng);
            
            const dist = currentCenter.distanceTo(targetLatLng);
            const zoomDiff = Math.abs(currentZoom - zoom);

            // Only issue setView if the map is not actively being dragged/pinched and has a tangible positional difference
            if (!isInteractingRef.current && (dist > 30 || zoomDiff > 0.5)) {
                map.setView([lat, lng], zoom, { animate: dist > 300 });
            }
        } catch (e) {
            console.error("Map setView failed:", e);
        }
    }
  }, [center, zoom, map, hasBounds]);
  return null;
};

const CustomZoomControls: React.FC = () => {
  const map = useMap();
  return (
    <div className="absolute top-16 right-3 md:right-4 z-[1001] flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/90 overflow-hidden pointer-events-auto select-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          map.zoomIn();
        }}
        className="w-8 h-8 hover:bg-slate-100 text-slate-800 active:text-blue-600 font-bold text-base flex items-center justify-center transition-colors cursor-pointer border-b border-slate-100"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          map.zoomOut();
        }}
        className="w-8 h-8 hover:bg-slate-100 text-slate-800 active:text-blue-600 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
        title="Zoom Out (−)"
        aria-label="Zoom Out"
      >
        −
      </button>
    </div>
  );
};

const ResizeHandler: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const FlyToBoundsUpdater: React.FC<{ bounds: L.LatLngBoundsExpression | null, onComplete?: () => void }> = ({ bounds, onComplete }) => {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
        const getSafeBoundsForLeaflet = (val: any): L.LatLngBounds | null => {
            if (!val) return null;
            
            const castToNumber = (v: any): number => {
                const parsed = typeof v === 'number' ? v : parseFloat(String(v));
                return Number.isFinite(parsed) ? parsed : NaN;
            };

            const points: [number, number][] = [];
            const extractPoints = (item: any) => {
                if (Array.isArray(item)) {
                    if (item.length === 2 && !Array.isArray(item[0]) && typeof item[0] !== 'object') {
                        const lat = castToNumber(item[0]);
                        const lng = castToNumber(item[1]);
                        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                            points.push([lat, lng]);
                        }
                    } else {
                        item.forEach(extractPoints);
                    }
                } else if (typeof item === 'object' && item !== null) {
                    const latVal = item.lat !== undefined ? item.lat : item.latitude;
                    const lngVal = item.lng !== undefined ? item.lng : item.longitude;
                    const lat = castToNumber(latVal);
                    const lng = castToNumber(lngVal);
                    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                        points.push([lat, lng]);
                    }
                }
            };

            extractPoints(val);
            
            if (points.length === 1) {
                return L.latLngBounds([points[0], points[0]]);
            } else if (points.length > 1) {
                return L.latLngBounds(points);
            }
            return null;
        };

        const validated = getSafeBoundsForLeaflet(bounds);
        let valid = false;
        if (validated && validated.isValid()) {
            valid = true;
            map.flyToBounds(validated, { padding: [50, 50], duration: 1.5 });
            const timer = setTimeout(() => {
                onComplete?.();
            }, 1600);
            return () => clearTimeout(timer);
        }
        if (!valid) {
            onComplete?.();
        }
    } catch (e) {
        console.warn("Invalid bounds for map flyToBounds:", e);
        onComplete?.();
    }
  }, [bounds, map, onComplete]);
  return null;
}

const DrawingHandler: React.FC<{
  tool: string;
  onDrawComplete: (geometry: any) => void;
  activeDrawingTool: ActiveDrawingTool;
  onMapClick?: (latlng: L.LatLng) => void;
  showMeasurementGuide?: boolean;
}> = ({ tool, onDrawComplete, activeDrawingTool, onMapClick, showMeasurementGuide = true }) => {
  const map = useMap();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [cursorPos, setCursorPos] = useState<L.LatLng | null>(null);
  const [lastSeedPos, setLastSeedPos] = useState<L.LatLng | null>(null);
  const isSketchingRef = useRef<boolean>(false);

  // Movable Drawing Info Banner State
  const [infoPos, setInfoPos] = useState<{ x: number; y: number } | null>(() => {
      const saved = safeStorage.getItem('agrimap_drawing_info_pos');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
          } catch (e) {}
      }
      return null;
  });
  const infoBannerRef = useRef<HTMLDivElement | null>(null);
  const infoDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  const handleInfoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      try {
          e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
      const rect = infoBannerRef.current?.getBoundingClientRect();
      infoDragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startLeft: rect ? rect.left : (window.innerWidth / 2 - 150),
          startTop: rect ? rect.top : 80
      };
  };

  const handleInfoPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!infoDragRef.current) return;
      e.preventDefault();
      const deltaX = e.clientX - infoDragRef.current.startX;
      const deltaY = e.clientY - infoDragRef.current.startY;
      const newLeft = Math.max(10, Math.min(window.innerWidth - 300, infoDragRef.current.startLeft + deltaX));
      const newTop = Math.max(10, Math.min(window.innerHeight - 80, infoDragRef.current.startTop + deltaY));
      setInfoPos({ x: Math.round(newLeft), y: Math.round(newTop) });
  };

  const handleInfoPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!infoDragRef.current) return;
      try {
          e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      infoDragRef.current = null;
      setInfoPos(curr => {
          if (curr) safeStorage.setItem('agrimap_drawing_info_pos', JSON.stringify(curr));
          return curr;
      });
  };

  useEffect(() => {
    if (tool) {
        map.getContainer().classList.add('is-drawing');
        map.doubleClickZoom.disable();
    } else {
        map.getContainer().classList.remove('is-drawing');
        map.doubleClickZoom.enable();
        setLastSeedPos(null);
    }
  }, [tool, map]);

  // Global mouseup release to smoothly finish pencil stroke anywhere on the screen
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (tool === 'pencil' && isSketchingRef.current) {
        isSketchingRef.current = false;
        try { map.dragging.enable(); } catch (err) {}
        if (points.length >= 2) {
          const final = points.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
          if (final.length >= 2) {
            onDrawComplete(final.map(p => [p.lat, p.lng]));
            setPoints([]);
          }
        }
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [tool, points, map, onDrawComplete]);

  useMapEvents({
    mousedown(e) {
        if (tool === 'pencil' && e && e.latlng && Number.isFinite(e.latlng.lat) && Number.isFinite(e.latlng.lng)) {
            isSketchingRef.current = true;
            try { map.dragging.disable(); } catch (err) {}
            setPoints([e.latlng]);
        }
    },
    mouseup(e) {
        if (tool === 'pencil' && isSketchingRef.current) {
            isSketchingRef.current = false;
            try { map.dragging.enable(); } catch (err) {}
            if (points.length >= 2) {
                const final = points.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
                if (final.length >= 2) {
                    onDrawComplete(final.map(p => [p.lat, p.lng]));
                    setPoints([]);
                }
            }
        }
    },
    click(e) {
        if (e && e.latlng && Number.isFinite(e.latlng.lat) && Number.isFinite(e.latlng.lng)) {
            if (onMapClick) onMapClick(e.latlng);
            if (!tool) return;
            // Pencil tool is purely freehand click-and-drag: ignore discrete clicks to avoid accidental dots
            if (tool === 'pencil') return;
            if (tool === 'note' || tool === 'seedling' || tool === 'checkpoint' || tool === 'camera') {
                if (tool === 'seedling' && lastSeedPos) {
                    const dist = e.latlng.distanceTo(lastSeedPos);
                    toast.info(`Distance from last seed: ${dist.toFixed(2)}m`, { duration: 2000 });
                }
                if (tool === 'seedling') setLastSeedPos(e.latlng);
                onDrawComplete([e.latlng.lat, e.latlng.lng]);
            } else {
                setPoints(prev => [...prev, e.latlng]);
            }
        }
    },
    dblclick(e) {
        if (!tool) return;
        if (e && e.latlng && Number.isFinite(e.latlng.lat) && Number.isFinite(e.latlng.lng)) {
            if (tool === 'area' || tool === 'line' || tool === 'sector' || tool === 'boundary') {
                const finalPoints = [...points, e.latlng].filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
                onDrawComplete(finalPoints.map(p => [p.lat, p.lng]));
                setPoints([]);
            } else if (tool === 'pencil') {
                // Ignore double click for pencil to avoid straight line closures
            } else if (tool === 'measure') {
                const finalPoints = [...points, e.latlng].filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
                let totalDist = 0;
                for (let i = 0; i < finalPoints.length - 1; i++) {
                    totalDist += finalPoints[i].distanceTo(finalPoints[i+1]);
                }
                toast.success(`📐 Ruler Measurement Completed! Total Distance: ${totalDist.toFixed(1)} meters`, { duration: 6000 });
                setPoints([]);
                setCursorPos(null);
                onDrawComplete(null);
            }
        }
    },
    mousemove(e) {
        if (tool && points.length > 0) {
            if (e && e.latlng && Number.isFinite(e.latlng.lat) && Number.isFinite(e.latlng.lng)) {
                setCursorPos(e.latlng);
                // Freehand pencil: capture points based on screen pixels for fluid writing and drawing
                if (tool === 'pencil' && isSketchingRef.current) {
                    setPoints(prev => {
                        const last = prev[prev.length - 1];
                        if (!last) return [...prev, e.latlng];
                        try {
                            const lastPx = map.latLngToContainerPoint(last);
                            const currPx = map.latLngToContainerPoint(e.latlng);
                            if (currPx.distanceTo(lastPx) >= 2.5) {
                                return [...prev, e.latlng];
                            }
                        } catch (err) {
                            if (e.latlng.distanceTo(last) >= 0.5) {
                                return [...prev, e.latlng];
                            }
                        }
                        return prev;
                    });
                }
            }
        }
    }
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setPoints([]);
            setCursorPos(null);
            isSketchingRef.current = false;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!tool) return null;

  const isArea = tool === 'area' || tool === 'sector' || tool === 'boundary' || tool === 'operationalLog' as any || tool === 'harvestLog' as any;
  const isPoint = tool === 'note' || tool === 'checkpoint' || tool === 'seedling';
  const isMeasure = tool === 'measure';
  const isPencil = tool === 'pencil';

  if (!isArea && tool !== 'line' && !isPoint && !isMeasure && !isPencil) return null;

  const previewPoints = cursorPos ? [...points, cursorPos] : points;
  
  const currentLength = useMemo(() => {
    if (previewPoints.length < 2) return 0;
    let totalDist = 0;
    for (let i = 0; i < previewPoints.length - 1; i++) {
        totalDist += previewPoints[i].distanceTo(previewPoints[i+1]);
    }
    return totalDist;
  }, [previewPoints]);

  return (
      <LayerGroup>
          {points.length > 0 && showMeasurementGuide && (
              <div 
                  ref={infoBannerRef}
                  onPointerDown={handleInfoPointerDown}
                  onPointerMove={handleInfoPointerMove}
                  onPointerUp={handleInfoPointerUp}
                  style={infoPos ? {
                      position: 'fixed',
                      left: `${infoPos.x}px`,
                      top: `${infoPos.y}px`,
                      transform: 'none',
                      zIndex: 1500
                  } : undefined}
                  className={`pointer-events-auto select-none ${infoPos ? '' : 'absolute top-20 left-1/2 -translate-x-1/2 z-[1000]'}`}
              >
                  <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-2xl flex flex-col items-center gap-1 border border-slate-700/80 animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <div 
                            className="cursor-move p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                            title="Drag to reposition this measurement banner"
                        >
                            <GripHorizontal size={13} />
                        </div>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${isPencil ? 'bg-amber-400' : 'bg-blue-500'}`} />
                        <p className="text-[10px] font-black uppercase tracking-widest">
                            {points.length} points • {
                                isPencil 
                                    ? 'Pencil Sketch (Drag or click to draw freely • Double-click or release to complete)'
                                    : isArea 
                                        ? 'Double-click to close area' 
                                        : tool === 'measure' 
                                            ? 'Double-click to complete measurement' 
                                            : 'Double-click to finish line'
                            }
                        </p>
                        {infoPos && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setInfoPos(null);
                                    safeStorage.removeItem('agrimap_drawing_info_pos');
                                }}
                                className="text-[9px] text-slate-400 hover:text-white underline ml-1 font-bold"
                            >
                                Reset
                            </button>
                        )}
                      </div>
                      {currentLength > 0 && (
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex gap-3">
                            <span className={isPencil ? 'text-amber-300' : 'text-blue-400'}>Length: {currentLength.toFixed(2)}m</span>
                            {isArea && previewPoints.length > 2 && (
                                <span>Area: {(currentLength * 0.1).toFixed(2)}m²*</span>
                            )}
                        </div>
                      )}
                  </div>
              </div>
          )}
          {isArea ? (
              previewPoints.length > 2 && previewPoints.every(p => isLatLngValid(p)) ? (
                <Polygon positions={previewPoints} pathOptions={{ color: activeDrawingTool.color || '#3388ff', weight: 2, dashArray: '5, 10', fillOpacity: 0.2 }} />
              ) : (
                previewPoints.length > 1 && previewPoints.every(p => isLatLngValid(p)) && (
                  <Polyline positions={previewPoints} pathOptions={{ color: activeDrawingTool.color || '#3388ff', weight: 2, dashArray: '5, 10' }} />
                )
              )
          ) : (
              previewPoints.length > 1 && previewPoints.every(p => isLatLngValid(p)) && (
                <Polyline 
                    positions={previewPoints} 
                    pathOptions={{ 
                        color: isPencil ? '#f59e0b' : (activeDrawingTool.color || '#3388ff'), 
                        weight: isPencil ? 3.5 : 2, 
                        dashArray: isPencil ? undefined : '5, 10',
                        lineCap: 'round',
                        lineJoin: 'round'
                    }} 
                />
              )
          )}
          {/* Suppress all circle marker dots when using pencil - purely clean freehand drawing */}
          {!isPencil && points.map((p, i) => isLatLngValid(p) && (
              <CircleMarker 
                key={`draw-pt-${i}`} 
                center={p} 
                radius={5} 
                pathOptions={{ 
                    fillColor: 'white', 
                    color: '#2563eb', 
                    weight: 2.5, 
                    fillOpacity: 1 
                }} 
              />
          ))}
      </LayerGroup>
  );
};

export interface FloatingSearchProps {
    onSearch: (bounds: L.LatLngBoundsExpression) => void;
    plantationFeatures: PlantationFeature[];
    onSelectFeature?: (id: string) => void;
    crops?: Crop[];
    activeOrgId?: string | null;
    onMyLocation?: (lat: number, lng: number, isGps: boolean, label?: string) => void;
}

export const FloatingSearch: React.FC<FloatingSearchProps> = ({ onSearch, plantationFeatures, onSelectFeature, onMyLocation }) => {
    const { language } = useLanguage();
    const isKa = language === 'ka';
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const isDeepValidLocal = (val: any): boolean => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'number') return Number.isFinite(val);
        if (Array.isArray(val)) return val.length > 0 && val.every(isDeepValidLocal);
        if (typeof val === 'object' && ('lat' in val || 'lng' in val)) {
            return Number.isFinite(val.lat) && Number.isFinite(val.lng);
        }
        return false;
    };

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }
        
        setLoading(true);
        toast.info("Acquiring GPS coordinates...");
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                    // Navigate to location bounds
                    onSearch([
                        [latitude - 0.003, longitude - 0.003],
                        [latitude + 0.003, longitude + 0.003]
                    ]);
                    
                    // Trigger the myLocation callback to show a custom live marker on map
                    if (onMyLocation) {
                        onMyLocation(latitude, longitude, true, 'Acquired real-time GPS coordinates');
                    }
                    
                    toast.success(`Position acquired: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                } else {
                    toast.error("Invalid coordinates fetched.");
                }
                setLoading(false);
            },
            (error) => {
                console.error("GPS error:", error);
                let msg = "Could not retrieve your location.";
                if (error.code === error.PERMISSION_DENIED) {
                    msg = "Location access denied. Please allow geolocation permission in your browser.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    msg = "Location information is unavailable.";
                } else if (error.code === error.TIMEOUT) {
                    msg = "Request to get location timed out.";
                }
                toast.error(msg);
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        let success = false;
        const q = query.trim();

        try {
            // Check if coordinates inputted like "41.7151, 44.8271" or similar
            const cleanQuery = q.replace(/[\[\]\(\)]/g, '').replace(/lat|lng|latitude|longitude|:/gi, ' ').trim();
            const parts = cleanQuery.split(/[\s,;\t]+/).map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                    onSearch([
                        [lat - 0.003, lng - 0.003],
                        [lat + 0.003, lng + 0.003]
                    ]);
                    if (onMyLocation) {
                        onMyLocation(lat, lng, false, `Manually inputted coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                    }
                    success = true;
                    toast.success(`Navigating to coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                    return;
                }
            }

            const lowerQ = q.toLowerCase();

            // 1. Search local platform features first
            if (plantationFeatures && plantationFeatures.length > 0) {
                const matchedFeature = plantationFeatures.find(f => 
                    f.name?.toLowerCase().includes(lowerQ) || 
                    f.notes?.toLowerCase().includes(lowerQ)
                );

                if (matchedFeature && matchedFeature.geometry) {
                    let boundsToSet: L.LatLngBoundsExpression | null = null;
                    
                    try {
                        const parsedGeom = parseGeometry(matchedFeature.geometry);
                        if (['area', 'sector', 'boundary', 'line', 'trench', 'irrigation_line'].includes(matchedFeature.type) && Array.isArray(parsedGeom) && parsedGeom.length > 0) {
                            const validPoints = parsedGeom.filter(p => isLatLngValid(p));
                            if (validPoints.length > 0) {
                                const b = L.latLngBounds(validPoints);
                                boundsToSet = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
                            }
                        } else if (['seedling', 'note', 'checkpoint'].includes(matchedFeature.type) && isLatLngValid(parsedGeom)) {
                            const geom = parsedGeom;
                            const lat = typeof geom[0] === 'number' ? geom[0] : parseFloat(geom[0]);
                            const lng = typeof geom[1] === 'number' ? geom[1] : parseFloat(geom[1]);
                            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                               boundsToSet = [[lat - 0.001, lng - 0.001], [lat + 0.001, lng + 0.001]];
                            }
                        }
                    } catch (err) {
                        console.warn("Failed to compute bounds for local feature match", err);
                    }

                    if (boundsToSet) {
                        onSearch(boundsToSet);
                        if (onSelectFeature) onSelectFeature(matchedFeature.id);
                        if (onMyLocation) {
                            // Focus point
                            let lat = 0, lng = 0;
                            if (Array.isArray(boundsToSet)) {
                                const b = L.latLngBounds(boundsToSet as any);
                                lat = b.getCenter().lat;
                                lng = b.getCenter().lng;
                            }
                            if (lat && lng) {
                                onMyLocation(lat, lng, false, `Feature: ${matchedFeature.name}`);
                            }
                        }
                        success = true;
                    }
                }
            }

            // 2. Service 1: ArcGIS Online Geocoding Service (Free, CORS-enabled, extremely reliable, no User-Agent blocks)
            if (!success) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout to prevent hanging
                    const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(q)}&maxLocations=1`, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.candidates && data.candidates.length > 0) {
                            const candidate = data.candidates[0];
                            const { x, y } = candidate.location;
                            const extent = candidate.extent;

                            if (Number.isFinite(y) && Number.isFinite(x)) {
                                if (extent && Number.isFinite(extent.ymin) && Number.isFinite(extent.xmin)) {
                                    onSearch([
                                        [extent.ymin, extent.xmin],
                                        [extent.ymax, extent.xmax]
                                    ]);
                                } else {
                                    onSearch([
                                        [y - 0.005, x - 0.005],
                                        [y + 0.005, x + 0.005]
                                    ]);
                                }
                                if (onMyLocation) {
                                    onMyLocation(y, x, false, candidate.address || q);
                                }
                                success = true;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("ArcGIS Geocoding unsuccessful or timed out, trying Nominatim...", e);
                }
            }

            // 3. Service 2: Nominatim Fallback
            if (!success) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000);
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&email=agrimappro@example.com`, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                            const { lat, lon, boundingbox, display_name } = data[0];
                            const latNum = parseFloat(lat);
                            const lonNum = parseFloat(lon);
                            
                            if (boundingbox && boundingbox.length === 4) {
                                const b = [
                                    parseFloat(boundingbox[0]), // south
                                    parseFloat(boundingbox[1]), // north
                                    parseFloat(boundingbox[2]), // west
                                    parseFloat(boundingbox[3])  // east
                                ];
                                if (b.every(Number.isFinite)) {
                                    onSearch([[b[0], b[2]], [b[1], b[3]]]);
                                    if (onMyLocation) {
                                        onMyLocation(latNum, lonNum, false, display_name || q);
                                    }
                                    success = true;
                                }
                            } else if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
                                onSearch([[latNum - 0.005, lonNum - 0.005], [latNum + 0.005, lonNum + 0.005]]);
                                if (onMyLocation) {
                                    onMyLocation(latNum, lonNum, false, display_name || q);
                                }
                                success = true;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Nominatim fallback failed or timed out:", e);
                }
            }

            if (!success) {
                toast.error("Location or feature not found.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2 w-full relative">
            <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 w-full shadow-lg" onMouseDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-2 py-1 border border-slate-100 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <SearchIcon className="h-4 w-4 text-slate-400 mr-1.5 shrink-0" />
                    <input 
                        type="text" 
                        placeholder={isKa ? 'ძიება: ადგილი, კოორდინატები...' : 'Search places or lat, lng...'} 
                        className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 w-full py-1.5 placeholder-slate-400"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                {/* Search Action Button */}
                <button 
                    onClick={handleSearch} 
                    disabled={loading || !query.trim()} 
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0"
                    title={isKa ? 'ლოკაციის / კოორდინატების ძიება' : 'Search Location / Coordinates'}
                >
                    {loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SearchIcon className="h-3.5 h-3.5" />}
                </button>
                {/* Geolocation Button */}
                <button 
                    onClick={handleLocateMe}
                    disabled={loading}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md active:scale-95 transition-all shrink-0"
                    title={isKa ? 'ჩემს GPS ლოკაციაზე გადასვლა' : 'Fly to My Live Geolocation'}
                >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

const MapEventsHandler: React.FC<{ 
    onMapClick?: (latlng: L.LatLng) => void;
    onSetCenter?: (center: [number, number]) => void;
    onSetZoom?: (zoom: number) => void;
    onContextMenu?: (screenPoint: { x: number; y: number }, coordinates?: { lat: number; lng: number }) => void;
    onMapContextMenu?: (screenPoint: { x: number; y: number }, coordinates?: { lat: number; lng: number }) => void;
}> = ({ onMapClick, onSetCenter, onSetZoom, onContextMenu, onMapContextMenu }) => {
    const moveTimerRef = useRef<any>(null);
    const zoomTimerRef = useRef<any>(null);

    useMapEvents({
        click(e) { if (e && e.latlng && onMapClick) onMapClick(e.latlng); },
        contextmenu(e) {
            if (e && e.originalEvent) {
                e.originalEvent.preventDefault();
                const coords = (e.latlng && Number.isFinite(e.latlng.lat) && Number.isFinite(e.latlng.lng))
                    ? { lat: e.latlng.lat, lng: e.latlng.lng }
                    : undefined;
                onContextMenu?.({ x: e.originalEvent.clientX, y: e.originalEvent.clientY }, coords);
                onMapContextMenu?.({ x: e.originalEvent.clientX, y: e.originalEvent.clientY }, coords);
            }
        },
        moveend(e) { 
            const center = e.target.getCenter();
            if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
                if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
                moveTimerRef.current = setTimeout(() => {
                    const roundedLat = Math.round(center.lat * 100000) / 100000;
                    const roundedLng = Math.round(center.lng * 100000) / 100000;
                    onSetCenter?.([roundedLat, roundedLng]);
                }, 450);
            }
        },
        zoomend(e) { 
            const zoom = e.target.getZoom();
            if (Number.isFinite(zoom)) {
                if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
                zoomTimerRef.current = setTimeout(() => {
                    onSetZoom?.(Math.round(zoom));
                }, 450);
            }
        }
    });

    useEffect(() => {
        return () => {
            if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
            if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
        };
    }, []);

    return null;
};

const EditControl: React.FC<{
  featureId: string | null;
  features: PlantationFeature[];
  onUpdate: (feature: PlantationFeature) => void;
}> = ({ featureId, features, onUpdate }) => {
  const map = useMap() as any;
  
  useEffect(() => {
    if (!featureId || !map.editTools) return;
    
    let targetLayer: any = null;
    map.eachLayer((layer: any) => {
      if (layer.options && layer.options.id === featureId) {
        targetLayer = layer;
      }
    });

    if (targetLayer && targetLayer.enableEdit) {
      targetLayer.enableEdit();
      
      const handleEdit = () => {
        const findRecursive = (featuresList: PlantationFeature[], targetId: string): PlantationFeature | null => {
          for (const f of featuresList) {
            if (f.id === targetId) return f;
            if ('bundledLines' in f && (f as any).bundledLines) {
              const found = findRecursive((f as any).bundledLines, targetId);
              if (found) return found;
            }
            if ('bundledSeedlings' in f && (f as any).bundledSeedlings) {
              const found = findRecursive((f as any).bundledSeedlings, targetId);
              if (found) return found;
            }
          }
          return null;
        };

        const feature = findRecursive(features, featureId);
        if (!feature) return;

        let nextGeom: any;
        if (targetLayer.getLatLngs) {
          const latlngs = targetLayer.getLatLngs();
          const flat = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
          const finalFlat = Array.isArray(flat[0]) ? flat[0] : flat;
          
          nextGeom = finalFlat
            .map((p: any) => {
                if (p && typeof p === 'object' && 'lat' in p && 'lng' in p) {
                    return [p.lat, p.lng];
                }
                return null;
            })
            .filter((p: any) => p !== null && Number.isFinite(p[0]) && Number.isFinite(p[1]));
        } else if (targetLayer.getLatLng) {
          const p = targetLayer.getLatLng();
          if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
              nextGeom = [p.lat, p.lng];
          }
        }

        if (nextGeom) {
          let updatedFeature = { ...feature, geometry: nextGeom };
          if (feature.type === 'line' || feature.type === 'trench' || feature.type === 'irrigation_line') {
            const fLine = feature as LinePlantationFeature;
            const spacing = fLine.defaultPlantSpacing || 1.0;
            const updatedCount = Math.max(1, Math.floor(calculateLineLength(nextGeom) / spacing));
            (updatedFeature as any).calculatedPlantCount = updatedCount;
          }
          setTimeout(() => {
            onUpdate(updatedFeature as any);
          }, 0);
        }
      };

      targetLayer.on('editable:dragend', handleEdit);
      targetLayer.on('editable:vertex:dragend', handleEdit);

      return () => {
        if (targetLayer) {
           if (targetLayer.disableEdit) targetLayer.disableEdit();
           targetLayer.off('editable:dragend', handleEdit);
           targetLayer.off('editable:vertex:dragend', handleEdit);
        }
      };
    }
  }, [featureId, map, features, onUpdate]);

  return null;
};

export interface MapComponentProps {
    center: [number, number];
    zoom: number;
    plantationFeatures: PlantationFeature[];
    layers: Layer[];
    onSelectFeature: (id: string | null, options?: { event?: MouseEvent; fromPanel?: boolean }) => void;
    selectedFeatureIds?: string[];
    highlightedFeatureIds?: string[];
    flyToBounds: L.LatLngBoundsExpression | null;
    onSetFlyToBounds?: (bounds: L.LatLngBoundsExpression | null) => void;
    activeDrawingTool?: ActiveDrawingTool;
    onFeatureDrawn?: (type: FeatureType | 'boundary' | any, geometry: any, clickPos?: any, metadata?: any) => void;
    onSetActiveDrawingTool?: (tool: ActiveDrawingTool) => void;
    onUpdateFeature?: (feature: PlantationFeature) => void;
    editingGeometryId?: string | null;
    trenchPreviewLines?: [number, number][][];
    showSearch?: boolean;
    operationalLogs?: OperationalLog[];
    harvestLogs?: HarvestLog[];
    externalUsers?: User[];
    activeOrgId?: string | null;
    onSetMapCenter?: (center: [number, number]) => void;
    onSetMapZoom?: (zoom: number) => void;
    onMoveFeature?: (id: string, deltaLat: number, deltaLng: number) => void;
    onEditGeometry?: (id: string | null) => void;
    onMapClick?: (latlng: L.LatLng) => void;
    externalOrganizations?: any[];
    onExternalUserMessage?: (u: any) => void;
    onExternalOrganizationMessage?: (org: any) => void;
    isMapFullScreen?: boolean;
    onSetIsMapFullScreen?: (isFull: boolean) => void;
    assistantMessages?: any[];
    onSendCommand?: (command: string) => void;
    onOperationalLogClick?: (log: OperationalLog, latlng: L.LatLng) => void;
    onHarvestLogClick?: (log: HarvestLog, latlng: L.LatLng) => void;
    children?: React.ReactNode;
    currentUser?: User | null;
    appMode?: string;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    crops?: Crop[];
    isSatellite?: boolean;
    setIsSatellite?: (val: boolean) => void;
    hideBottomControls?: boolean;
    hideUndoRedo?: boolean;
    showMeasurementGuide?: boolean;
    showZoomControls?: boolean;
    onDeleteFeature?: (ids: string[]) => void;
    liveShowcases?: LiveMapShowcase[];
    inProgressShowcasePoints?: [number, number][];
    onShowcaseMapClick?: (latlng: [number, number]) => void;
    onContextMenuFeature?: (feature: PlantationFeature, screenPoint: { x: number; y: number }, coordinates?: { lat: number; lng: number }) => void;
    onMapContextMenu?: (screenPoint: { x: number; y: number }, coordinates?: { lat: number; lng: number }) => void;
    cameras?: PlantationCamera[];
    showCameras?: boolean;
    onSelectCameraForLiveView?: (cam: PlantationCamera) => void;
    onSelectCameraForProperties?: (cam: PlantationCamera) => void;
    onUpdateCameraPosition?: (cameraId: string, lat: number, lng: number) => void;
    customSlopes?: any[];
    showCumulativeCoverage?: boolean;
    droneMission?: DroneFlightMission | null;
    showDroneMissions?: boolean;
    onSelectDroneMissionForProperties?: () => void;
    simulatedDronePosition?: { lat: number; lng: number; heading: number } | null;
}

export const MapComponent: React.FC<MapComponentProps> = (props) => {
    const { t, language } = useLanguage();
    const isKa = language === 'ka';
    const { 
        center, zoom, plantationFeatures = EMPTY_ARRAY, onSelectFeature, 
        selectedFeatureIds = EMPTY_ARRAY, highlightedFeatureIds = EMPTY_ARRAY, flyToBounds,
        onSetFlyToBounds, showSearch = true,
        activeDrawingTool, onFeatureDrawn, onSetActiveDrawingTool,
        operationalLogs = EMPTY_ARRAY, harvestLogs = EMPTY_ARRAY, externalUsers = EMPTY_ARRAY,
        editingGeometryId, onUpdateFeature, currentUser, appMode,
        onUndo, onRedo, canUndo, canRedo, crops = EMPTY_ARRAY,
        trenchPreviewLines, liveShowcases = EMPTY_ARRAY, inProgressShowcasePoints = EMPTY_ARRAY,
        onShowcaseMapClick, showMeasurementGuide = true, showZoomControls = true,
        onContextMenuFeature, onMapContextMenu,
        cameras = EMPTY_ARRAY, showCameras = true, onSelectCameraForLiveView, onSelectCameraForProperties,
        onUpdateCameraPosition, customSlopes, showCumulativeCoverage,
        droneMission, showDroneMissions = true, onSelectDroneMissionForProperties, simulatedDronePosition
    } = props;

    const rawCenter = isValidCoordinate(center) ? center : [42.14, 42.0];
    const safeCenter: [number, number] = [
        typeof rawCenter[0] === 'string' ? parseFloat(rawCenter[0] as any) : rawCenter[0],
        typeof rawCenter[1] === 'string' ? parseFloat(rawCenter[1] as any) : rawCenter[1]
    ];
    const safeZoom = Number.isFinite(zoom) ? zoom : 13;

    const [localIsSatellite, setLocalIsSatellite] = useState(true);
    const activeIsSatellite = props.isSatellite !== undefined ? props.isSatellite : localIsSatellite;
    const [myLocation, setMyLocation] = useState<{ lat: number; lng: number; isGps: boolean; label?: string } | null>(null);
    const [gpsLocating, setGpsLocating] = useState(false);

    // Live GPS Telemetry Fleet (Worker smart jackets and vehicles)
    const [gpsFleet, setGpsFleet] = useState<any[]>(() => {
        try {
            const raw = safeStorage.getItem('agrimap_gps_devices');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });
    const [showGpsFleet, setShowGpsFleet] = useState<boolean>(true);

    useEffect(() => {
        const handleGpsUpdate = (e: any) => {
            if (e?.detail?.devices && Array.isArray(e.detail.devices)) {
                setGpsFleet(e.detail.devices);
            }
        };

        window.addEventListener('agrimap:gps_live_update', handleGpsUpdate);
        return () => {
            window.removeEventListener('agrimap:gps_live_update', handleGpsUpdate);
        };
    }, []);

    // Pencil Sketch Comment Actions: Toggle on/off and Remove from on-map badge
    useEffect(() => {
        const handleToggleComment = (e: any) => {
            const targetId = e?.detail?.featureId;
            if (!targetId || !onUpdateFeature) return;
            const target = plantationFeatures.find(f => f.id === targetId);
            if (target) {
                const nextState = target.showCommentOnMap === false ? true : false;
                onUpdateFeature({
                    ...target,
                    showCommentOnMap: nextState
                });
                toast.info(nextState ? "Displaying comment on map" : "Comment hidden from map");
            }
        };

        const handleRemoveComment = (e: any) => {
            const targetId = e?.detail?.featureId;
            if (!targetId || !onUpdateFeature) return;
            const target = plantationFeatures.find(f => f.id === targetId);
            if (target) {
                onUpdateFeature({
                    ...target,
                    comment: ''
                });
                toast.success("Removed comment from pencil sketch");
            }
        };

        window.addEventListener('agrimap:toggle-pencil-comment', handleToggleComment);
        window.addEventListener('agrimap:remove-pencil-comment', handleRemoveComment);
        return () => {
            window.removeEventListener('agrimap:toggle-pencil-comment', handleToggleComment);
            window.removeEventListener('agrimap:remove-pencil-comment', handleRemoveComment);
        };
    }, [plantationFeatures, onUpdateFeature]);

    const handleMapLocateMe = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }

        setGpsLocating(true);
        const toastId = toast.info("Finding your exact physical location...", { duration: 6000 });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                    // Focus there
                    onSetFlyToBounds?.([
                        [latitude - 0.003, longitude - 0.003],
                        [latitude + 0.003, longitude + 0.003]
                    ]);

                    setMyLocation({
                        lat: latitude,
                        lng: longitude,
                        isGps: true,
                        label: 'Your Current Physical Location'
                    });

                    toast.dismiss(toastId);
                    toast.success("Successfully arrived at your current coordinates!");
                } else {
                    toast.error("Invalid GPS coordinates retrieved.");
                }
                setGpsLocating(false);
            },
            (err) => {
                console.warn("GPS Locate Me failed:", err);
                let message = "Could not verify your GPS coordinates.";
                if (err.code === err.PERMISSION_DENIED) {
                    message = "Please allow location access in your browser settings to verify your real-time coordinates.";
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    message = "GPS data unavailable or unstable. Please ensure your device has clear satellite line-of-sight.";
                } else if (err.code === err.TIMEOUT) {
                    message = "GPS request timed out. Please try again.";
                }
                toast.dismiss(toastId);
                toast.error(message);
                setGpsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const handleToggleSatellite = () => {
        const nextVal = !activeIsSatellite;
        setLocalIsSatellite(nextVal);
        if (props.setIsSatellite) {
            props.setIsSatellite(nextVal);
        }
    };

    const allFeatures = useMemo(() => {
        return extractAllFeatures(plantationFeatures);
    }, [plantationFeatures]);

    // O(1) indexed lookup caches to prevent quadratic slowdown on feature updates
    const featureIndex = useMemo(() => {
        const map = new Map<string, PlantationFeature>();
        allFeatures.forEach(f => map.set(f.id, f));
        return map;
    }, [allFeatures]);

    const layerIndex = useMemo(() => {
        const map = new Map<string, Layer>();
        props.layers?.forEach(l => map.set(l.id, l));
        return map;
    }, [props.layers]);

    const isFeatureVisibleRec = (f: PlantationFeature, visited: Set<string> = new Set()): boolean => {
        if (!f || visited.has(f.id)) return false;
        visited.add(f.id);
        if (f.isVisible === false) return false;
        if (f.parentId) {
            const parentFeature = featureIndex.get(f.parentId);
            if (parentFeature && !isFeatureVisibleRec(parentFeature, visited)) return false;
        }
        if (f.layerId) {
            const parentLayer = layerIndex.get(f.layerId);
            if (parentLayer && parentLayer.isVisible === false) return false;
        }
        return true;
    };

    const filteredFeatures = useMemo(() => {
        return allFeatures.filter(f => {
            if (!f || !isFeatureVisibleRec(f)) return false;
            
            const geometry = parseGeometry(f.geometry);
            if (f.type === 'seedling' || f.type === 'note' || f.type === 'checkpoint') {
                if (!isLatLngValid(geometry)) {
                    if (f.type === 'note' || f.type === 'checkpoint') {
                        // Try emergency fallback for legacy note formats
                        const raw: any = f.geometry;
                        if (raw && typeof raw.lat === 'number' && typeof raw.lng === 'number') return true;
                    }
                    return false;
                }
            } else {
                // For areas, boundaries, and lines, ensure we have enough points
                if (!Array.isArray(geometry) || geometry.length === 0) return false;
                
                const minPoints = (f.type as any) === 'line' || (f.type as any) === 'trench' || (f.type as any) === 'irrigation_line' ? 2 : 3;
                if (geometry.length < minPoints) return false;
                
                // Final safety check for geometry points validity
                if (!geometry.every(p => isLatLngValid(p))) return false;
            }
            return true;
        }).sort((a, b) => {
            // Higher zIndex on top. System boundaries always stay lower (-100) and lines/seedlings on top
            const zA = a.zIndex ?? (a.type === 'boundary' ? -100 : a.type === 'area' || a.type === 'sector' ? 0 : 10);
            const zB = b.zIndex ?? (b.type === 'boundary' ? -100 : b.type === 'area' || b.type === 'sector' ? 0 : 10);
            return zA - zB;
        });
    }, [allFeatures, props.layers]);

    const renderFeature = (feature: PlantationFeature): React.ReactNode => {
        const isSelected = selectedFeatureIds.includes(feature.id);
        const isHighlighted = highlightedFeatureIds.includes(feature.id);
        const isEditing = editingGeometryId === feature.id;
        const featureColor = feature.color || DEFAULT_MAP_COLOR;
        const color = isSelected ? '#ef4444' : isHighlighted ? '#3b82f6' : featureColor;
        
        // Render Polygon: Area / Sector / Boundary
        if (feature.type === 'area' || feature.type === 'sector' || feature.type === 'boundary') {
            const geometry = parseGeometry(feature.geometry);
            if (!Array.isArray(geometry) || geometry.length < 3) return null;
            const validGeom = geometry.filter(p => isLatLngValid(p)) as [number, number][];
            if (validGeom.length < 3) return null;

            const isSector = feature.type === 'sector';
            const isBoundary = feature.type === 'boundary';
            const defaultColor = isBoundary ? '#2563eb' : isSector ? '#10b981' : '#3b82f6';
            const effectiveColor = isSelected ? '#ef4444' : isHighlighted ? '#3b82f6' : (feature.color || defaultColor);
            const fillColor = isSelected ? '#ef4444' : (feature.color || defaultColor);
            const fillOpacity = isSelected ? 0.35 : isBoundary ? 0.08 : isSector ? 0.22 : 0.18;
            const weight = isSelected ? 3.5 : isBoundary ? 3 : 2.5;

            const areaSqMeters = getSphericalPolygonArea(validGeom);
            const areaHa = areaSqMeters / 10000;

            return (
                <Polygon
                    key={feature.id}
                    positions={validGeom}
                    pathOptions={{
                        color: effectiveColor,
                        fillColor,
                        fillOpacity,
                        weight,
                        dashArray: isBoundary ? '6, 6' : undefined,
                        className: isSelected ? 'leaflet-feature-selected' : '',
                        id: feature.id
                    } as any}
                    eventHandlers={{
                        click: (e) => {
                            if (e && e.originalEvent) {
                                L.DomEvent.stopPropagation(e.originalEvent);
                            }
                            onSelectFeature(feature.id, { event: e?.originalEvent });
                        },
                        contextmenu: (e) => {
                            if (e && e.originalEvent) {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                e.originalEvent.preventDefault();
                            }
                            onSelectFeature(feature.id, { event: e?.originalEvent });
                            if (onContextMenuFeature && e && e.originalEvent) {
                                onContextMenuFeature(feature, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                            }
                        }
                    }}
                    {...({ id: feature.id } as any)}
                >
                    <Tooltip direction="center" permanent={false} className="bg-slate-900/90 backdrop-blur-md text-white border border-slate-700 shadow-xl rounded-xl p-2 font-black text-[10px] uppercase tracking-wider pointer-events-none">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: effectiveColor }} />
                            <span>{feature.name || (isSector ? 'Sector' : isBoundary ? 'Boundary' : 'Area')}</span>
                        </div>
                        <div className="text-emerald-400 font-mono text-[9px] mt-0.5">
                            {areaHa >= 0.01 ? `${areaHa.toFixed(2)} Ha` : `${areaSqMeters.toFixed(0)} m²`}
                            {(feature as any).cropType ? ` • ${(feature as any).cropType}` : ''}
                        </div>
                    </Tooltip>
                </Polygon>
            );
        }

        // Render Polyline: Line / Trench / Road / Irrigation Line / Pencil Sketch
        if (feature.type === 'line' || feature.type === 'trench' || feature.type === 'irrigation_line' || (feature as any).type === 'pencil') {
            const geometry = parseGeometry(feature.geometry);
            if (!Array.isArray(geometry) || geometry.length < 2) return null;
            const validGeom = geometry.filter(p => isLatLngValid(p)) as [number, number][];
            if (validGeom.length < 2) return null;

            const isPencil = feature.isPencil || feature.subType === 'pencil' || (feature as any).type === 'pencil';
            const isRoad = (feature as LinePlantationFeature).lineType === 'road' || (feature as LinePlantationFeature).lineType === 'path';
            const isTrench = !isRoad && (feature.type === 'trench' || (feature as LinePlantationFeature).lineType === 'row');
            const isIrrigation = feature.type === 'irrigation_line' || (feature as LinePlantationFeature).lineType === 'irrigation';
            const defaultColor = isPencil ? '#f59e0b' : isRoad ? '#78716c' : isTrench ? '#f97316' : isIrrigation ? '#0284c7' : '#eab308';
            const effectiveColor = isSelected ? '#ef4444' : isHighlighted ? '#3b82f6' : (feature.color || defaultColor);
            const weight = isSelected ? 5 : isRoad ? 5 : isPencil ? 3.5 : isTrench ? 3.5 : 3;
            const dashArray = isIrrigation ? '4, 6' : undefined;

            const lineLength = calculateLineLength(validGeom);
            const plantCount = (feature as LinePlantationFeature).calculatedPlantCount;
            const midpoint = validGeom[Math.floor(validGeom.length / 2)];

            return (
                <React.Fragment key={feature.id}>
                    <Polyline
                        positions={validGeom}
                        pathOptions={{
                            color: effectiveColor,
                            weight,
                            dashArray,
                            lineCap: 'round',
                            lineJoin: 'round',
                            opacity: isSelected ? 1 : 0.95,
                            className: isSelected ? 'leaflet-feature-selected' : '',
                            id: feature.id
                        } as any}
                        eventHandlers={{
                            click: (e) => {
                                if (e && e.originalEvent) {
                                    L.DomEvent.stopPropagation(e.originalEvent);
                                }
                                onSelectFeature(feature.id, { event: e?.originalEvent });
                                // For pencil or clicked lines, provide instant option opening on left-click as requested
                                if (isPencil && onContextMenuFeature && e && e.originalEvent) {
                                    onContextMenuFeature(feature, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                                }
                            },
                            contextmenu: (e) => {
                                if (e && e.originalEvent) {
                                    L.DomEvent.stopPropagation(e.originalEvent);
                                    e.originalEvent.preventDefault();
                                }
                                onSelectFeature(feature.id, { event: e?.originalEvent });
                                if (onContextMenuFeature && e && e.originalEvent) {
                                    onContextMenuFeature(feature, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                                }
                            }
                        }}
                        {...({ id: feature.id } as any)}
                    >
                        <Tooltip direction="top" className="bg-slate-900/90 backdrop-blur-md text-white border border-slate-700 shadow-xl rounded-xl p-2 font-black text-[10px] uppercase tracking-wider pointer-events-none">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: effectiveColor }} />
                                <span>{feature.name || (isPencil ? '✏️ Pencil Sketch' : isRoad ? '🚗 Road' : isTrench ? 'Trench' : 'Line')}</span>
                            </div>
                            <div className="text-amber-400 font-mono text-[9px] mt-0.5">
                                {`${lineLength.toFixed(1)}m`}
                                {isPencil ? ' • Left/Right-click for options' : isTrench ? ' • Right-click to Move/Convert/Delete' : (plantCount ? ` • ${plantCount} plants` : '')}
                            </div>
                        </Tooltip>
                    </Polyline>

                    {isPencil && midpoint && (
                        <Marker
                            position={midpoint}
                            icon={createPencilSketchBadgeIcon(feature, lineLength, isSelected)}
                            eventHandlers={{
                                click: (e) => {
                                    if (e && e.originalEvent) {
                                        L.DomEvent.stopPropagation(e.originalEvent);
                                    }
                                    onSelectFeature(feature.id, { event: e?.originalEvent });
                                    if (onContextMenuFeature && e && e.originalEvent) {
                                        onContextMenuFeature(feature, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                                    }
                                }
                            }}
                        />
                    )}
                </React.Fragment>
            );
        }

        // Render Seedling Marker
        if (feature.type === 'seedling') {
            const geometry = parseGeometry(feature.geometry);
            if (!isLatLngValid(geometry)) return null;
            const condition = (feature as SeedlingPlantationFeature).condition || 'Good';
            const variety = (feature as SeedlingPlantationFeature).cropVariety || '';
            
            return (
                <Marker 
                    key={feature.id} 
                    position={geometry as [number, number]} 
                    icon={createSeedlingIcon(condition, isSelected)} 
                    eventHandlers={{ 
                        click: (e) => {
                            if (e && e.originalEvent) {
                                L.DomEvent.stopPropagation(e.originalEvent);
                            }
                            onSelectFeature(feature.id, { event: e?.originalEvent });
                        },
                        contextmenu: (e) => {
                            if (e && e.originalEvent) {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                e.originalEvent.preventDefault();
                            }
                            onSelectFeature(feature.id, { event: e?.originalEvent });
                            if (onContextMenuFeature && e && e.originalEvent) {
                                onContextMenuFeature(feature, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                            }
                        }
                    }}
                    {...({ id: feature.id } as any)}
                >
                    <Tooltip direction="top" offset={[0, -10]} className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 shadow-xl rounded-lg px-2.5 py-1.5 font-black text-[10px] uppercase tracking-wider pointer-events-none">
                        <div className="text-white font-bold">{feature.name}</div>
                        {variety && <div className="text-emerald-400 text-[9px] mt-0.5">{variety}</div>}
                    </Tooltip>
                </Marker>
            );
        }

        // Render Note / Checkpoint Marker
        if (feature.type === 'note' || feature.type === 'checkpoint') {
            const geometry = parseGeometry(feature.geometry);
            if (!isLatLngValid(geometry)) return null;
            const status = (feature as any).status || 'pending';
            const isCompleted = status === 'completed';
            
            return (
                <Marker 
                    key={feature.id} 
                    position={geometry as [number, number]} 
                    icon={createMonitoringIcon(feature as any)} 
                    eventHandlers={{ 
                        click: (e) => {
                            if (e && e.originalEvent) {
                                L.DomEvent.stopPropagation(e.originalEvent);
                            }
                            onSelectFeature(feature.id, { event: e?.originalEvent });
                        },
                        contextmenu: (e) => {
                            if (e && e.originalEvent) {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                e.originalEvent.preventDefault();
                            }
                            onSelectFeature(feature.id, { event: e?.originalEvent });
                            if (onContextMenuFeature && e && e.originalEvent) {
                                onContextMenuFeature(feature, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                            }
                        }
                    }}
                    {...({ id: feature.id } as any)}
                >
                    <Tooltip direction="top" className="bg-white border-none shadow-xl rounded-xl p-3">
                        <div className="font-black text-[10px] uppercase">{feature.name}</div>
                    </Tooltip>
                    <Popup>
                        <div className="p-2.5 min-w-[200px] text-slate-800">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                    (feature as any).monitoringType === 'work' || (feature as any).source === 'tasks'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : (feature as any).monitoringType === 'task' || (feature as any).source === 'planner'
                                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                    {(feature as any).taskType || (feature as any).monitoringType || feature.type}
                                </span>
                                <span className={`text-[9px] font-black uppercase ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {isCompleted ? '✓ Completed' : '● Active'}
                                </span>
                            </div>

                            <div className="text-sm font-black text-slate-900 mb-1 leading-snug">{feature.name}</div>
                            <p className="text-[11px] text-slate-600 mb-2.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                {feature.notes || feature.comment || (isKa ? 'საველე წერტილი' : 'Field location marker')}
                            </p>

                            {/* Interactive Priority & Color Picker */}
                            <div className="mb-2.5 p-2 bg-slate-50/95 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                        {isKa ? 'პრიორიტეტი & ფერი' : 'Priority & Color'}
                                    </span>
                                    <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase ${
                                        ((feature as any).priority || 'medium') === 'urgent' ? 'bg-red-100 text-red-700' :
                                        ((feature as any).priority || 'medium') === 'high' ? 'bg-rose-100 text-rose-700' :
                                        ((feature as any).priority || 'medium') === 'low' ? 'bg-slate-200 text-slate-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {((feature as any).priority || 'medium').toUpperCase()}
                                    </span>
                                </div>

                                {/* Priority level buttons */}
                                <div className="grid grid-cols-4 gap-1 mb-2">
                                    <button
                                        type="button"
                                        title={isKa ? "სასწრაფო (წითელი)" : "Urgent (Crimson Red)"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateFeature?.({
                                                ...feature,
                                                priority: 'urgent',
                                                color: '#dc2626',
                                                customColor: '#dc2626'
                                            } as any);
                                            toast.success(isKa ? "პრიორიტეტი: სასწრაფო (წითელი)" : "Priority: Urgent (Red)");
                                        }}
                                        className={`py-1 px-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                            (feature as any).priority === 'urgent'
                                                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                                                : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
                                        }`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                        {isKa ? 'სასწრ' : 'Urg'}
                                    </button>
                                    <button
                                        type="button"
                                        title={isKa ? "მაღალი (წითელი)" : "High (Red)"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateFeature?.({
                                                ...feature,
                                                priority: 'high',
                                                color: '#ef4444',
                                                customColor: '#ef4444'
                                            } as any);
                                            toast.success(isKa ? "პრიორიტეტი: მაღალი (წითელი)" : "Priority: High (Red)");
                                        }}
                                        className={`py-1 px-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                            (feature as any).priority === 'high'
                                                ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-300'
                                                : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                                        }`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                        {isKa ? 'მაღალი' : 'High'}
                                    </button>
                                    <button
                                        type="button"
                                        title={isKa ? "საშუალო (ყვითელი)" : "Medium (Yellow)"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateFeature?.({
                                                ...feature,
                                                priority: 'medium',
                                                color: '#f59e0b',
                                                customColor: '#f59e0b'
                                            } as any);
                                            toast.success(isKa ? "პრიორიტეტი: საშუალო (ყვითელი)" : "Priority: Medium (Yellow)");
                                        }}
                                        className={`py-1 px-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                            !(feature as any).priority || (feature as any).priority === 'medium'
                                                ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                                                : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                                        }`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                        {isKa ? 'საშ' : 'Med'}
                                    </button>
                                    <button
                                        type="button"
                                        title={isKa ? "დაბალი (რუხი)" : "Low (Grey)"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateFeature?.({
                                                ...feature,
                                                priority: 'low',
                                                color: '#64748b',
                                                customColor: '#64748b'
                                            } as any);
                                            toast.success(isKa ? "პრიორიტეტი: დაბალი (რუხი)" : "Priority: Low (Grey)");
                                        }}
                                        className={`py-1 px-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                            (feature as any).priority === 'low'
                                                ? 'bg-slate-600 text-white shadow-sm ring-2 ring-slate-400'
                                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        {isKa ? 'დაბალი' : 'Low'}
                                    </button>
                                </div>

                                {/* Custom Color palette row */}
                                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">
                                        {isKa ? 'ფერის არჩევა:' : 'Select Color:'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {[
                                            { hex: '#ef4444', label: 'Red (High)' },
                                            { hex: '#f59e0b', label: 'Yellow (Med)' },
                                            { hex: '#10b981', label: 'Emerald' },
                                            { hex: '#3b82f6', label: 'Blue' },
                                            { hex: '#8b5cf6', label: 'Purple' },
                                            { hex: '#64748b', label: 'Grey (Low)' },
                                        ].map(col => {
                                            const isSelected = (feature as any).color === col.hex || (feature as any).customColor === col.hex;
                                            return (
                                                <button
                                                    key={col.hex}
                                                    type="button"
                                                    title={col.label}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateFeature?.({
                                                            ...feature,
                                                            color: col.hex,
                                                            customColor: col.hex
                                                        } as any);
                                                        toast.success(isKa ? "წერტილის ფერი შეიცვალა" : "Marker color updated");
                                                    }}
                                                    style={{ backgroundColor: col.hex }}
                                                    className={`w-4 h-4 rounded-full border border-white shadow-sm transition-transform hover:scale-125 cursor-pointer ${
                                                        isSelected ? 'ring-2 ring-indigo-500 scale-110' : ''
                                                    }`}
                                                />
                                            );
                                        })}
                                        {/* Color Picker input */}
                                        <label 
                                            className="relative w-4 h-4 rounded-full overflow-hidden border border-slate-300 cursor-pointer shadow-sm hover:scale-110 transition-transform" 
                                            title={isKa ? "საკუთარი ფერის არჩევა" : "Choose custom color"}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="color"
                                                value={(feature as any).color || '#ef4444'}
                                                onChange={(e) => {
                                                    const hex = e.target.value;
                                                    onUpdateFeature?.({
                                                        ...feature,
                                                        color: hex,
                                                        customColor: hex
                                                    } as any);
                                                }}
                                                className="absolute -top-3 -left-3 w-10 h-10 opacity-0 cursor-pointer"
                                            />
                                            <span className="w-full h-full block bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Mark Completed Toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const nextStatus = isCompleted ? 'pending' : 'completed';
                                    onUpdateFeature?.({ ...feature, status: nextStatus } as any);
                                }}
                                className={`w-full py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer ${
                                    isCompleted ? 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200' : 'bg-emerald-600 text-white shadow-md shadow-emerald-200 hover:bg-emerald-700'
                                }`}
                            >
                                {isCompleted ? (isKa ? 'აღდგენა (აქტიური)' : 'RESTORE ITEM') : (isKa ? 'შესრულებულად მონიშვნა' : 'MARK COMPLETED')}
                            </button>

                            {/* Open in Module Button */}
                            {((feature as any).monitoringType === 'work' || (feature as any).source === 'tasks') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.dispatchEvent(new CustomEvent('agrimap_navigate_module', { detail: { mode: 'tasks', featureId: feature.id } }));
                                    }}
                                    className="w-full mt-1.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-black text-[9px] uppercase tracking-wider border border-amber-200 transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                    <span>{isKa ? 'სამუშაოების მოდულში გახსნა' : 'Open in Tasks & Works'}</span>
                                </button>
                            )}

                            {((feature as any).monitoringType === 'task' || (feature as any).source === 'planner' || feature.type === 'note') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.dispatchEvent(new CustomEvent('agrimap_navigate_module', { detail: { mode: 'planner', featureId: feature.id } }));
                                    }}
                                    className="w-full mt-1.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-black text-[9px] uppercase tracking-wider border border-blue-200 transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                    <span>{isKa ? 'დამგეგმავში / შენიშვნებში ნახვა' : 'Open in Planner / Notes'}</span>
                                </button>
                            )}

                            {/* Remove from Map */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (props.onDeleteFeature) {
                                        props.onDeleteFeature([feature.id]);
                                        toast.success(isKa ? "ელემენტი წაიშალა რუკაზე." : "Item removed from map.");
                                    } else {
                                        toast.error(isKa ? "წაშლა მიუწვდომელია." : "Deletion not supported in this view.");
                                    }
                                }}
                                className="w-full mt-1.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-[8.5px] uppercase tracking-wider border border-red-200 transition-all cursor-pointer"
                            >
                                {isKa ? 'რუკიდან წაშლა / მოცილება' : 'REMOVE FROM MAP'}
                            </button>
                        </div>
                    </Popup>
                </Marker>
            );
        }
        return null;
    };

    return (
        <div className="h-full w-full relative min-h-[400px]">
            {activeDrawingTool?.tool && ['checkpoint', 'note', 'seedling'].includes(activeDrawingTool.tool) && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2030] bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl p-2.5 px-4 flex flex-wrap items-center justify-center gap-3 text-white pointer-events-auto leading-none animate-in fade-in slide-in-from-top-3 max-w-[95%] md:max-w-auto">
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="relative flex h-3 w-3">
                            <span 
                                className="relative inline-flex rounded-full h-3 w-3 shadow-sm border border-white/60"
                                style={{ backgroundColor: activeDrawingTool.color || '#ef4444' }}
                            />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
                            Placing {activeDrawingTool.tool === 'checkpoint' ? 'Checkpoint' : activeDrawingTool.tool === 'note' ? 'Note / Marker' : 'Seedling'}
                        </span>
                    </div>

                    {/* Priority & Color Selection */}
                    <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700/80 shrink-0">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mr-1">Importance:</span>
                        <button
                            type="button"
                            onClick={() => onSetActiveDrawingTool?.({ ...activeDrawingTool, priority: 'urgent', color: '#dc2626' })}
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                                activeDrawingTool.color === '#dc2626' || (activeDrawingTool as any).priority === 'urgent'
                                    ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400 font-bold'
                                    : 'text-red-400 hover:bg-slate-700/80'
                            }`}
                        >
                            Urgent (Red)
                        </button>
                        <button
                            type="button"
                            onClick={() => onSetActiveDrawingTool?.({ ...activeDrawingTool, priority: 'high', color: '#ef4444' })}
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                                activeDrawingTool.color === '#ef4444' || (activeDrawingTool as any).priority === 'high'
                                    ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-300 font-bold'
                                    : 'text-rose-400 hover:bg-slate-700/80'
                            }`}
                        >
                            High (Red)
                        </button>
                        <button
                            type="button"
                            onClick={() => onSetActiveDrawingTool?.({ ...activeDrawingTool, priority: 'medium', color: '#f59e0b' })}
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                                activeDrawingTool.color === '#f59e0b' || (activeDrawingTool as any).priority === 'medium'
                                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300 font-bold'
                                    : 'text-amber-400 hover:bg-slate-700/80'
                            }`}
                        >
                            Med (Yellow)
                        </button>
                        <button
                            type="button"
                            onClick={() => onSetActiveDrawingTool?.({ ...activeDrawingTool, priority: 'low', color: '#64748b' })}
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                                activeDrawingTool.color === '#64748b' || (activeDrawingTool as any).priority === 'low'
                                    ? 'bg-slate-600 text-white shadow-sm ring-2 ring-slate-400 font-bold'
                                    : 'text-slate-400 hover:bg-slate-700/80'
                            }`}
                        >
                            Low (Grey)
                        </button>

                        <div className="flex items-center gap-1 ml-1.5 pl-1.5 border-l border-slate-700">
                            {[
                                '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'
                            ].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => onSetActiveDrawingTool?.({ ...activeDrawingTool, color: c, priority: c === '#dc2626' ? 'urgent' : c === '#ef4444' ? 'high' : 'medium' })}
                                    style={{ backgroundColor: c }}
                                    className={`w-3.5 h-3.5 rounded-full border border-white shadow-sm transition-transform hover:scale-125 cursor-pointer ${
                                        activeDrawingTool.color === c ? 'ring-2 ring-white scale-110' : ''
                                    }`}
                                />
                            ))}
                            <label className="relative w-3.5 h-3.5 rounded-full overflow-hidden border border-white cursor-pointer hover:scale-125 transition-transform" title="Custom color">
                                <input
                                    type="color"
                                    value={activeDrawingTool.color || '#ef4444'}
                                    onChange={(e) => onSetActiveDrawingTool?.({ ...activeDrawingTool, color: e.target.value })}
                                    className="absolute -top-2 -left-2 w-8 h-8 opacity-0 cursor-pointer"
                                />
                                <span className="w-full h-full block bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500" />
                            </label>
                        </div>
                    </div>

                    <div className="w-px h-4 bg-slate-700 shrink-0" />
                    <button
                        onClick={() => {
                            if (!navigator.geolocation) {
                                toast.error("Geolocation is not supported by your browser.");
                                return;
                            }
                            const toastId = toast.info("Acquiring GPS for automatic point placement...");
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    const { latitude, longitude } = position.coords;
                                    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                                        // Save location marker
                                        setMyLocation({
                                            lat: latitude,
                                            lng: longitude,
                                            isGps: true,
                                            label: `Placed ${activeDrawingTool.tool} under current GPS`
                                        });
                                        
                                        // Trigger onFeatureDrawn to construct the checkpoint or note data with priority & color
                                        if (onFeatureDrawn) {
                                            onFeatureDrawn(activeDrawingTool.tool as any, [latitude, longitude], undefined, {
                                                priority: (activeDrawingTool as any).priority || (activeDrawingTool.color === '#dc2626' ? 'urgent' : activeDrawingTool.color === '#ef4444' ? 'high' : 'medium'),
                                                color: activeDrawingTool.color,
                                                customColor: activeDrawingTool.color
                                            });
                                        }
                                        
                                        // Fly to it
                                        onSetFlyToBounds?.([
                                            [latitude - 0.002, longitude - 0.002],
                                            [latitude + 0.002, longitude + 0.002]
                                        ]);
                                        
                                        // Dismiss tool
                                        onSetActiveDrawingTool?.({ tool: null });
                                        
                                        toast.dismiss(toastId);
                                        toast.success(`Success! Planted ${activeDrawingTool.tool === 'checkpoint' ? 'Checkpoint' : activeDrawingTool.tool === 'note' ? 'Note' : 'Seedling'} directly under your current GPS coordinates.`);
                                    } else {
                                        toast.dismiss(toastId);
                                        toast.error("Invalid GPS coordinates retrieved.");
                                    }
                                },
                                (err) => {
                                    toast.dismiss(toastId);
                                    toast.error("Could not fetch GPS: " + err.message);
                                },
                                { enableHighAccuracy: true, timeout: 8000 }
                            );
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-md shrink-0"
                        title="Snap & save marker directly under your actual GPS location"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Add at My GPS Position</span>
                    </button>
                    <button 
                        onClick={() => onSetActiveDrawingTool?.({ tool: null })}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all shrink-0"
                    >
                        <XIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {showSearch && <div className="absolute top-6 left-6 md:top-6 md:left-6 z-[2010] flex flex-col items-center gap-2 w-auto max-w-[280px] md:max-w-xs px-2 md:px-0 mobile-bottom-search transition-all leading-normal">
                <FloatingSearch 
                    onSearch={(b) => {
                        onSetFlyToBounds?.(b);
                    }} 
                    plantationFeatures={plantationFeatures} 
                    onSelectFeature={onSelectFeature} 
                    crops={crops} 
                    activeOrgId={props.activeOrgId || props.currentUser?.currentOrgId}
                    onMyLocation={(lat, lng, isGps, label) => {
                        setMyLocation({ lat, lng, isGps, label });
                    }}
                />
            </div>}

            {!props.hideUndoRedo && (canUndo || canRedo) && <div className="absolute top-6 right-4 md:right-4 z-[1001] flex items-center gap-1 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-1 animate-in slide-in-from-right-4 transition-all hover:scale-105 active:scale-95 mobile-top-right">
                <button onClick={onUndo} disabled={!canUndo} className={`p-2.5 rounded-xl transition-all ${canUndo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`} title="Undo Action">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
                <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
                <button onClick={onRedo} disabled={!canRedo} className={`p-2.5 rounded-xl transition-all ${canRedo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`} title="Redo Action">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
                </button>
            </div>}

            {/* Dedicated Custom Satellite Toggle & Map Controls Row */}
            {!props.hideBottomControls && (
                <div className="absolute bottom-6 left-6 z-[2010] flex items-center gap-2 pointer-events-auto leading-none">
                    <button 
                        onClick={handleToggleSatellite}
                        className="flex items-center gap-2 px-3 py-2.5 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-800 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95"
                        title={activeIsSatellite ? "Switch to Street Map Style" : "Switch to Satellite Imagery Mode"}
                    >
                        <svg className={`w-4 h-4 ${activeIsSatellite ? 'text-emerald-600' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5A1.5 1.5 0 0018 10.5V10a2 2 0 012-2h1.065M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{activeIsSatellite ? t('map.satellite') : t('map.street_map')}</span>
                    </button>

                    <button 
                        onClick={handleMapLocateMe}
                        disabled={gpsLocating}
                        className="flex items-center gap-2 px-3 py-2.5 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-800 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 disabled:opacity-55"
                        title="Find and Fly to My Real-time Geolocation"
                    >
                        {gpsLocating ? (
                            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-3.5 h-3.5 text-emerald-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        )}
                        <span>{gpsLocating ? t('map.locating') : t('map.fly_to_me')}</span>
                    </button>

                    {/* GPS Telemetry Toggle (Jackets & Vehicles) */}
                    <button 
                        onClick={() => setShowGpsFleet(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 backdrop-blur-xl border shadow-2xl rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                            showGpsFleet
                                ? 'bg-slate-900/95 text-cyan-300 border-cyan-500/40 shadow-cyan-950/30'
                                : 'bg-white/95 text-slate-500 border-slate-200/80 hover:bg-slate-50'
                        }`}
                        title={showGpsFleet ? "Hide GPS Telemetry (Smart Jackets & Vehicles)" : "Show GPS Telemetry (Smart Jackets & Vehicles)"}
                    >
                        <span className="text-xs">🛰️</span>
                        <span>{isKa ? 'GPS ტელემეტრია' : 'GPS Fleet'}</span>
                        {gpsFleet.length > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-black ${
                                showGpsFleet ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {gpsFleet.length}
                            </span>
                        )}
                    </button>
                </div>
            )}
            
            <MapContainer 
                center={safeCenter} 
                zoom={safeZoom} 
                scrollWheelZoom={true} 
                style={{ height: '100%', width: '100%' }} 
                zoomControl={false} 
                doubleClickZoom={!activeDrawingTool?.tool}
                maxZoom={28}
                preferCanvas={true}
                {...{ editable: true } as any}
            >
                {activeIsSatellite ? (
                    <TileLayer 
                        key="sat-layer"
                        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']} 
                        attribution={isKa ? 'Leaflet | &copy; Google (გუგლი)' : 'Leaflet | &copy; Google'} 
                        maxZoom={28} 
                        maxNativeZoom={21} 
                    />
                ) : (
                    <TileLayer 
                        key="street-layer"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        attribution={isKa ? 'Leaflet | &copy; OpenStreetMap-ის ავტორები' : 'Leaflet | &copy; OpenStreetMap contributors'} 
                        maxZoom={28} 
                        maxNativeZoom={21} 
                    />
                )}
                <LayersControl position="topright">
                    <LayersControl.Overlay checked name={isKa ? "სექტორები" : "Sectors"}>
                        <LayerGroup>
                            {filteredFeatures.filter(f => f.type === 'area' || f.type === 'sector' || f.type === 'boundary').map(feature => renderFeature(feature))}
                        </LayerGroup>
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name={isKa ? "ხაზები & თხრილები" : "Lines & Trenches"}>
                        <LayerGroup>
                            {filteredFeatures.filter(f => f.type === 'line' || f.type === 'trench' || f.type === 'irrigation_line').map(feature => renderFeature(feature))}
                            {trenchPreviewLines && trenchPreviewLines.map((lineCoords, idx) => {
                                const validCoords = lineCoords.filter(isValidCoordinate).map(p => [Number(p[0]), Number(p[1])] as [number, number]);
                                if (validCoords.length < 2) return null;
                                return (
                                    <Polyline
                                        key={`trench-preview-${idx}`}
                                        positions={validCoords}
                                        pathOptions={{
                                            color: '#3b82f6', // bright blue to stand out elegantly or #8b4513 for trench ochre
                                            weight: 2.5,
                                            dashArray: '6, 6',
                                            opacity: 0.9
                                        }}
                                    />
                                );
                            })}
                        </LayerGroup>
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name={isKa ? "ნერგები" : "Seedlings"}>
                        <LayerGroup>
                            {filteredFeatures.filter(f => f.type === 'seedling').map(feature => renderFeature(feature))}
                        </LayerGroup>
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name={isKa ? "ჩანაწერები & წერტილები" : "Notes & Checkpoints"}>
                        <LayerGroup>
                            {filteredFeatures.filter(f => f.type === 'note' || f.type === 'checkpoint').map(feature => renderFeature(feature))}
                        </LayerGroup>
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name={isKa ? "ოპერაციების ჟურნალი" : "Operations Log"}>
                        <LayerGroup>
                            {operationalLogs.map((log, logIdx) => {
                                const geom = parseGeometry(log.geometry);
                                if (!Array.isArray(geom)) return null;
                                const validGeom = geom.filter(p => isLatLngValid(p));
                                if (validGeom.length === 0) return null;
                                const key = `op-log-${log.id || logIdx}`;
                                const pathOptions = { color: '#f97316', fillColor: '#f97316', fillOpacity: 0.15, dashArray: '5, 5', weight: 3 };
                                const clickHandler = (e: L.LeafletMouseEvent) => props.onOperationalLogClick?.(log, e.latlng);
                                
                                if (validGeom.length === 1) {
                                    return <CircleMarker key={key} center={validGeom[0] as [number, number]} radius={10} pathOptions={pathOptions} eventHandlers={{ click: clickHandler }} />;
                                } else if (validGeom.length === 2) {
                                    return <Polyline key={key} positions={validGeom as [number, number][]} pathOptions={pathOptions} eventHandlers={{ click: clickHandler }} />;
                                } else {
                                    return <Polygon key={key} positions={validGeom as [number, number][]} pathOptions={pathOptions} eventHandlers={{ click: clickHandler }} />;
                                }
                            })}
                        </LayerGroup>
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name={isKa ? "მოსავლის ჟურნალი" : "Harvest Log"}>
                        <LayerGroup>
                            {harvestLogs.map((log, logIdx) => {
                                const geom = parseGeometry(log.geometry);
                                if (!Array.isArray(geom)) return null;
                                const validGeom = geom.filter(p => isLatLngValid(p));
                                if (validGeom.length === 0) return null;
                                const key = `har-log-${log.id || logIdx}`;
                                const pathOptions = { color: '#4d7c0f', fillColor: '#84cc16', fillOpacity: 0.4, weight: 3 };
                                const clickHandler = (e: L.LeafletMouseEvent) => props.onHarvestLogClick?.(log, e.latlng);
                                
                                const content = (
                                    <Tooltip direction="top" className="bg-slate-900 border-none shadow-2xl rounded-xl p-0 overflow-hidden">
                                        <div className="bg-slate-900 p-3 min-w-[150px]">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-[10px] font-black text-white uppercase tracking-tighter">{isKa ? 'მოსავლის ჟურნალი' : 'Harvest Area Log'}</div>
                                                <div className="text-[8px] text-slate-400 font-bold">{new Date(log.date).toLocaleDateString()}</div>
                                            </div>
                                            <div className="space-y-1">
                                                {(log.yieldByVariety || []).map((y: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
                                                        <span className="text-[9px] font-bold text-indigo-300 uppercase">{y.variety || (isKa ? 'შერეული' : 'Mixed')}</span>
                                                        <span className="text-[10px] font-black text-white">{y.weightKg?.toFixed(1) || 0}kg</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Tooltip>
                                );

                                if (validGeom.length === 1) {
                                    return (
                                        <CircleMarker key={key} center={validGeom[0] as [number, number]} radius={10} pathOptions={pathOptions} eventHandlers={{ click: clickHandler }}>
                                            {content}
                                        </CircleMarker>
                                    );
                                } else if (validGeom.length === 2) {
                                    return (
                                        <Polyline key={key} positions={validGeom as [number, number][]} pathOptions={pathOptions} eventHandlers={{ click: clickHandler }}>
                                            {content}
                                        </Polyline>
                                    );
                                } else {
                                    return (
                                        <Polygon key={key} positions={validGeom as [number, number][]} pathOptions={pathOptions} eventHandlers={{ click: clickHandler }}>
                                            {content}
                                        </Polygon>
                                    );
                                }
                            })}
                        </LayerGroup>
                    </LayersControl.Overlay>
                    <LayersControl.Overlay checked name={isKa ? "პირდაპირი ეთერი (Showcases)" : "Live Showcases & Call Broadcasts"}>
                        <LayerGroup>
                            {liveShowcases.map((showcase) => {
                                const validCoords = (showcase.coordinates || []).filter(isLatLngValid);
                                if (validCoords.length === 0) return null;
                                const color = showcase.color || '#10b981';
                                
                                const popupContent = (
                                    <div className="p-3 min-w-[200px] leading-relaxed">
                                        <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100">
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                                                📍 Live Showcase
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-mono">
                                                {new Date(showcase.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <h5 className="text-xs font-black text-slate-900 mb-1">{showcase.title}</h5>
                                        {showcase.note && (
                                            <p className="text-[11px] text-slate-600 mb-2 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                                "{showcase.note}"
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                            <span>By {showcase.authorName}</span>
                                            {showcase.areaHa && (
                                                <span className="font-bold text-emerald-700">{showcase.areaHa.toFixed(2)} Ha</span>
                                            )}
                                        </div>
                                        {showcase.meetUrl && (
                                            <div className="mt-2 pt-2 border-t border-slate-100">
                                                <a
                                                    href={showcase.meetUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block text-center py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                                                >
                                                    📹 Join Live Call
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );

                                if (showcase.shapeType === 'point' || validCoords.length === 1) {
                                    return (
                                        <CircleMarker
                                            key={showcase.id}
                                            center={validCoords[0]}
                                            radius={12}
                                            pathOptions={{
                                                color: '#10b981',
                                                fillColor: '#34d399',
                                                fillOpacity: 0.85,
                                                weight: 3
                                            }}
                                        >
                                            <Popup>{popupContent}</Popup>
                                        </CircleMarker>
                                    );
                                } else if (showcase.shapeType === 'line' || validCoords.length === 2) {
                                    return (
                                        <Polyline
                                            key={showcase.id}
                                            positions={validCoords}
                                            pathOptions={{
                                                color: '#10b981',
                                                weight: 4,
                                                dashArray: '8, 8',
                                                opacity: 0.95
                                            }}
                                        >
                                            <Popup>{popupContent}</Popup>
                                        </Polyline>
                                    );
                                } else {
                                    return (
                                        <Polygon
                                            key={showcase.id}
                                            positions={validCoords}
                                            pathOptions={{
                                                color: '#10b981',
                                                fillColor: '#10b981',
                                                fillOpacity: 0.25,
                                                weight: 3.5,
                                                dashArray: '4, 6'
                                            }}
                                        >
                                            <Popup>{popupContent}</Popup>
                                        </Polygon>
                                    );
                                }
                            })}

                            {/* In-progress drawing preview */}
                            {inProgressShowcasePoints.length > 0 && (
                                <>
                                    {inProgressShowcasePoints.length === 1 ? (
                                        <CircleMarker
                                            center={inProgressShowcasePoints[0]}
                                            radius={8}
                                            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9 }}
                                        />
                                    ) : (
                                        <Polyline
                                            positions={inProgressShowcasePoints}
                                            pathOptions={{ color: '#10b981', weight: 3, dashArray: '6, 6' }}
                                        />
                                    )}
                                    {inProgressShowcasePoints.map((pt, idx) => (
                                        <CircleMarker
                                            key={`showcase-vertex-${idx}`}
                                            center={pt}
                                            radius={5}
                                            pathOptions={{ color: '#ffffff', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
                                        />
                                    ))}
                                </>
                            )}
                        </LayerGroup>
                    </LayersControl.Overlay>
                </LayersControl>

                {/* 1. Surveillance Cameras Layer with Optical FOV Cones & Live View Prompt */}
                {showCameras && cameras.length > 0 && cameras.map((cam: PlantationCamera) => {
                    if (!Number.isFinite(cam.lat) || !Number.isFinite(cam.lng)) return null;
                    const fovPolygon = computeFovConePolygon(cam.lat, cam.lng, cam.azimuthDeg || 0, cam.fovAngleDeg || 95, cam.rangeM || 75);
                    const blindPolygon = computeBlindZonePolygon({
                        centerLat: cam.lat,
                        centerLng: cam.lng,
                        azimuthDeg: cam.azimuthDeg || 0,
                        fovAngleDeg: cam.fovAngleDeg || 95,
                        rangeM: cam.rangeM || 75,
                        mountHeightM: cam.mountHeightM || 6,
                        tiltAngleDeg: cam.tiltAngleDeg || 4
                    });
                    const blindDistM = computeBlindZoneDistanceM(cam.mountHeightM || 6, cam.tiltAngleDeg || 4, cam.fovAngleDeg || 95);

                    return (
                        <React.Fragment key={cam.id}>
                            {/* Optical Field of View (FOV) Cone */}
                            {fovPolygon.length > 2 && (
                                <Polygon
                                    positions={fovPolygon}
                                    pathOptions={{
                                        color: '#3b82f6',
                                        weight: 1.5,
                                        dashArray: '4, 4',
                                        fillColor: '#3b82f6',
                                        fillOpacity: 0.16
                                    }}
                                />
                            )}
                            {/* Blind Zone Arc directly beneath the camera pole */}
                            {blindPolygon.length > 2 && (
                                <Polygon
                                    positions={blindPolygon}
                                    pathOptions={{
                                        color: '#ef4444',
                                        weight: 1.2,
                                        dashArray: '2, 2',
                                        fillColor: '#ef4444',
                                        fillOpacity: 0.35
                                    }}
                                />
                            )}
                            {/* Camera Pole Marker - Draggable for easy moving & replacement */}
                            <Marker
                                position={[cam.lat, cam.lng]}
                                icon={createCameraMarkerIcon(cam)}
                                draggable={true}
                                eventHandlers={{
                                    click: () => {
                                        onSelectCameraForProperties?.(cam);
                                    },
                                    dragend: (e) => {
                                        const marker = e.target;
                                        const pos = marker.getLatLng();
                                        onUpdateCameraPosition?.(cam.id, pos.lat, pos.lng);
                                    }
                                }}
                            >
                                <Tooltip direction="top" className="bg-slate-900 text-white border border-slate-700 shadow-xl rounded-xl p-2 font-mono text-[10px]">
                                    <div><b>[CH0{cam.channel}] {cam.name}</b></div>
                                    <div className="text-slate-400">Tilt: {cam.tiltAngleDeg || 4}° • Range: {cam.rangeM}m</div>
                                </Tooltip>
                                <Popup>
                                    <div className="p-3 min-w-[220px] text-slate-800">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold text-[10px]">
                                                CH0{cam.channel}
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                {cam.status || 'ONLINE'}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 leading-tight mb-1">{cam.name}</h4>
                                        <div className="text-[11px] text-slate-600 mb-2.5 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-0.5">
                                            <div><b>IP:</b> {cam.ipAddress}:{cam.rtspPort}</div>
                                            <div><b>Model:</b> {cam.model}</div>
                                            <div><b>Optical:</b> Range {cam.rangeM}m • FOV {cam.fovAngleDeg}°</div>
                                            <div><b>Pole:</b> Height {cam.mountHeightM}m • Tilt {cam.tiltAngleDeg || 4}°</div>
                                            <div><b>Blind Zone:</b> &lt; {blindDistM}m</div>
                                        </div>

                                        {/* Action buttons: Live View & Properties */}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectCameraForLiveView?.(cam);
                                                }}
                                                className="flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-blue-500/30 transition-all cursor-pointer active:scale-95"
                                            >
                                                <span>🎥 Live</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectCameraForProperties?.(cam);
                                                }}
                                                className="flex-1 py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                                            >
                                                <span>⚙️ Config</span>
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}

                {/* 2. Drone Missions Layer: Waypoints, Outbound/Return Legs, Circle Sectors */}
                {showDroneMissions && droneMission && !droneMission.isHidden && (
                    <React.Fragment>
                        {/* Waypoints Mode */}
                        {droneMission.mode === 'waypoints' && droneMission.waypoints.length > 0 && (
                            <>
                                {droneMission.waypoints.length > 1 && (
                                    <Polyline
                                        positions={droneMission.waypoints.map(wp => [wp.lat, wp.lng] as [number, number])}
                                        eventHandlers={{
                                            click: () => {
                                                onSelectDroneMissionForProperties?.();
                                            }
                                        }}
                                        pathOptions={{
                                            color: '#06b6d4',
                                            weight: 3.5,
                                            dashArray: '6, 6',
                                            opacity: 0.95
                                        }}
                                    />
                                )}
                                {droneMission.waypoints.map((wp, idx) => (
                                    <Marker
                                        key={wp.id}
                                        position={[wp.lat, wp.lng]}
                                        eventHandlers={{
                                            click: () => {
                                                onSelectDroneMissionForProperties?.();
                                            }
                                        }}
                                        icon={createDroneWaypointIcon(
                                            idx === 0 ? 'H' : wp.leg === 'return' ? 'R' : String(idx),
                                            idx === 0,
                                            wp.leg === 'return'
                                        )}
                                    >
                                        <Tooltip direction="top">
                                            <span className="font-mono text-[10px]">
                                                {idx === 0 ? 'Takeoff / Home' : wp.leg === 'return' ? 'Return Leg' : `WP #${idx}`} ({droneMission.altitudeM}m AGL)
                                            </span>
                                        </Tooltip>
                                    </Marker>
                                ))}
                            </>
                        )}

                        {/* Circle Sector Mode */}
                        {droneMission.mode === 'circle_sector' && droneMission.circleCenter && (
                            <>
                                <Circle
                                    center={droneMission.circleCenter}
                                    radius={droneMission.circleRadiusM || 60}
                                    eventHandlers={{
                                        click: () => {
                                            onSelectDroneMissionForProperties?.();
                                        }
                                    }}
                                    pathOptions={{
                                        color: '#06b6d4',
                                        weight: 2.5,
                                        dashArray: '8, 8',
                                        fillColor: '#06b6d4',
                                        fillOpacity: 0.14
                                    }}
                                />
                                <Marker
                                    position={droneMission.circleCenter}
                                    eventHandlers={{
                                        click: () => {
                                            onSelectDroneMissionForProperties?.();
                                        }
                                    }}
                                    icon={createDroneWaypointIcon('◎', true)}
                                >
                                    <Tooltip direction="top">
                                        <span className="font-mono text-[10px]">Sector Orbit Center ({droneMission.circleRadiusM || 60}m radius)</span>
                                    </Tooltip>
                                </Marker>
                            </>
                        )}

                        {/* Simulated In-Flight Drone Marker */}
                        {simulatedDronePosition && (
                            <Marker
                                position={[simulatedDronePosition.lat, simulatedDronePosition.lng]}
                                icon={createDroneFlightIcon(simulatedDronePosition.heading)}
                            >
                                <Tooltip direction="top" permanent>
                                    <div className="font-mono text-[9px] bg-slate-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/50">
                                        ALT: {droneMission.altitudeM}m | SPD: {droneMission.speedMs}m/s
                                    </div>
                                </Tooltip>
                            </Marker>
                        )}
                    </React.Fragment>
                )}

                {/* 3. Custom Sculpted Slopes Layer (Rings & Influence Zones) */}
                {customSlopes && customSlopes.filter(s => s && s.enabled).map((slope: any) => {
                    const isExcavation = slope.peakHeightM < 0;
                    return (
                        <React.Fragment key={slope.id}>
                            <Circle
                                center={[slope.centerLat, slope.centerLng]}
                                radius={slope.radiusM}
                                pathOptions={{
                                    color: isExcavation ? '#ef4444' : '#10b981',
                                    weight: 1.8,
                                    dashArray: '4, 4',
                                    fillColor: isExcavation ? '#ef4444' : '#10b981',
                                    fillOpacity: 0.12
                                }}
                            >
                                <Tooltip direction="top">
                                    <span className="font-mono text-[10px] font-bold">
                                        ⛰️ {slope.name}: {slope.peakHeightM > 0 ? `+${slope.peakHeightM}m` : `${slope.peakHeightM}m`} (R={slope.radiusM}m)
                                    </span>
                                </Tooltip>
                            </Circle>
                        </React.Fragment>
                    );
                })}

                <EditControl 
                  featureId={props.editingGeometryId || null} 
                  features={plantationFeatures} 
                  onUpdate={(f) => onUpdateFeature?.(f as any)} 
                />
                <ResizeHandler />
                {showZoomControls && <CustomZoomControls />}
                <MapUpdater center={safeCenter} zoom={safeZoom} hasBounds={!!flyToBounds} />
                <FlyToBoundsUpdater bounds={flyToBounds} onComplete={() => onSetFlyToBounds?.(null)} />
                <MapEventsHandler 
                    onMapClick={props.onMapClick} 
                    onSetCenter={props.onSetMapCenter} 
                    onSetZoom={props.onSetMapZoom} 
                    onContextMenu={onMapContextMenu}
                    onMapContextMenu={onMapContextMenu}
                />
                {activeDrawingTool?.tool && (
                    <DrawingHandler 
                        tool={activeDrawingTool.tool} 
                        showMeasurementGuide={showMeasurementGuide}
                        onDrawComplete={(geometry) => { 
                            if (activeDrawingTool.tool !== 'measure' && geometry) { 
                                onFeatureDrawn?.(activeDrawingTool.tool as any, geometry, undefined, {
                                    priority: (activeDrawingTool as any).priority || (activeDrawingTool.color === '#dc2626' ? 'urgent' : activeDrawingTool.color === '#ef4444' ? 'high' : 'medium'),
                                    color: activeDrawingTool.color,
                                    customColor: activeDrawingTool.color
                                }); 
                            } 
                            onSetActiveDrawingTool?.({ tool: null }); 
                        }} 
                        activeDrawingTool={activeDrawingTool} 
                        onMapClick={props.onMapClick} 
                    />
                )}
                {myLocation && isLatLngValid([myLocation.lat, myLocation.lng]) && (
                    <Marker 
                        position={[myLocation.lat, myLocation.lng]} 
                        icon={createMyLocationIcon(myLocation.isGps)}
                    >
                        <Popup>
                            <div className="p-2.5 min-w-[170px] leading-tight" onMouseDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-base">{myLocation.isGps ? '🔹' : '📍'}</span>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        {myLocation.isGps ? 'Your Location' : 'Target Location'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold mb-2">
                                    {myLocation.label || 'Acquired Location'}
                                </p>
                                <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-center select-all cursor-pointer font-mono text-[9px] text-slate-600">
                                    {myLocation.lat.toFixed(6)}, {myLocation.lng.toFixed(6)}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* GPS Telemetry Fleet: Smart Worker Jackets and Vehicles */}
                {showGpsFleet && gpsFleet.map((dev: any) => {
                    if (!isLatLngValid([dev.lat, dev.lng])) return null;
                    return (
                        <React.Fragment key={`gps-${dev.id}`}>
                            {/* Breadcrumb Trail */}
                            {dev.history && Array.isArray(dev.history) && dev.history.length > 1 && (
                                <Polyline
                                    positions={dev.history}
                                    pathOptions={{
                                        color: dev.type === 'worker_jacket' ? '#38bdf8' : '#4ade80',
                                        weight: 3,
                                        opacity: 0.75,
                                        dashArray: '4, 6'
                                    }}
                                />
                            )}
                            <Marker
                                position={[dev.lat, dev.lng]}
                                icon={createGpsDeviceIcon(dev)}
                            >
                                <Popup>
                                    <div className="p-3 min-w-[220px] text-slate-900 leading-tight">
                                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black uppercase rounded-md">
                                                {dev.type === 'worker_jacket' ? '🦺 Worker Jacket' : '🚜 Farm Vehicle'}
                                            </span>
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-md flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                {dev.status}
                                            </span>
                                        </div>
                                        <div className="text-sm font-black uppercase text-slate-900 mb-1">
                                            {dev.name}
                                        </div>
                                        <div className="text-[11px] text-slate-600 font-bold mb-2">
                                            Assigned: <span className="text-slate-900 font-black">{dev.assignedTo || 'Unassigned'}</span>
                                        </div>
                                        {dev.rowAssignment && (
                                            <div className="text-[10px] text-blue-600 bg-blue-50 p-1.5 rounded-lg font-bold mb-2 border border-blue-100">
                                                📍 {dev.rowAssignment}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200/70 mb-2">
                                            <div>Speed: <span className="font-mono font-black text-slate-800">{dev.speedKmh} km/h</span></div>
                                            <div>Battery: <span className="font-mono font-black text-slate-800">{dev.batteryPct}%</span></div>
                                            <div>Altitude: <span className="font-mono font-black text-slate-800">{dev.altitudeM} m</span></div>
                                            <div>Accuracy: <span className="font-mono font-black text-slate-800">±{dev.accuracyM} m</span></div>
                                        </div>
                                        <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
                                            <span>IMEI: {dev.imei}</span>
                                            <span>Proto: {dev.protocol}</span>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}
                {props.children}
            </MapContainer>
        </div>
    );
};

export default MapComponent;
