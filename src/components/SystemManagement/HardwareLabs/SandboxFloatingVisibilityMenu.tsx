import React from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

interface SandboxFloatingVisibilityMenuProps {
    isOpen: boolean;
    onClose: () => void;
    visibility: any;
    onToggleVisibilityKey: (key: string) => void;
    onHideAll: () => void;
    onShowAll: () => void;
    counts?: {
        cameras: number;
        workers: number;
        soil: number;
        water: number;
        spinePoints: number;
    };
    isKa?: boolean;
}

export const SandboxFloatingVisibilityMenu: React.FC<SandboxFloatingVisibilityMenuProps> = ({
    isOpen,
    onClose,
    visibility,
    onToggleVisibilityKey,
    onHideAll,
    onShowAll,
    counts,
    isKa = false
}) => {
    if (!isOpen) return null;

    const layersList = [
        { key: 'showCameras', label: isKa ? 'სათვალთვალო კამერები & ბოძები' : 'Surveillance Cameras & Poles', count: counts?.cameras },
        { key: 'showBlindZones', label: isKa ? 'კამერის ბრმა ზონები (Nadir)' : 'Camera Nadir Blind Zones' },
        { key: 'showDronePath', label: isKa ? 'დრონის მარშრუტი & წერტილები' : 'Drone Flight Path & Waypoints' },
        { key: 'showWorkersGps', label: isKa ? 'თანამშრომლების GPS ტრეკერები' : 'Worker GPS Trackers', count: counts?.workers },
        { key: 'showSoilSensors', label: isKa ? 'ნიადაგის NPK & ტენიანობა' : 'Soil NPK & Moisture Sensors', count: counts?.soil },
        { key: 'showWaterSensors', label: isKa ? 'წყლის ხარჯი & ჭის დონე' : 'Water Flow & Well Level Stations', count: counts?.water },
        { key: 'showMoundSlope', label: isKa ? '3D რელიეფის ქედი & განივი ხაზები' : '3D Mound Spine & Width Lines', count: counts?.spinePoints },
        { key: 'showSectors', label: isKa ? 'დარგვის რელიეფის კონტური' : 'Planting Mound Perimeter Outline' },
        { key: 'showTrenches', label: isKa ? 'თხრილები & რიგები' : 'Reference Trenches' }
    ];

    return (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1300] w-88 bg-slate-950/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-xl p-3.5 space-y-3 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-black text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Eye size={14} className="text-indigo-400" />
                    {isKa ? 'ფენები & ხილვადობის მართვა' : 'Map Layers & Item Visibility'}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Master Quick Actions: Hide All / Show All */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={onHideAll}
                    className="py-1.5 px-3 bg-red-950/80 hover:bg-red-900/90 text-red-200 border border-red-800/60 rounded-xl font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                    <EyeOff size={13} />
                    <span>{isKa ? 'ყველას დამალვა' : 'Hide All Items'}</span>
                </button>
                <button
                    type="button"
                    onClick={onShowAll}
                    className="py-1.5 px-3 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-200 border border-emerald-800/60 rounded-xl font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                    <Eye size={13} />
                    <span>{isKa ? 'ყველას გამოჩენა' : 'Show All Items'}</span>
                </button>
            </div>

            {/* Individual Layer Checkboxes */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {layersList.map(item => (
                    <label 
                        key={item.key} 
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-850 cursor-pointer transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={Boolean((visibility as any)[item.key])}
                                onChange={() => onToggleVisibilityKey(item.key)}
                                className="rounded accent-indigo-500 cursor-pointer"
                            />
                            <span className="text-slate-300 font-medium text-[11px]">{item.label}</span>
                        </span>
                        {typeof item.count === 'number' && (
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                {item.count}
                            </span>
                        )}
                    </label>
                ))}
            </div>
        </div>
    );
};
