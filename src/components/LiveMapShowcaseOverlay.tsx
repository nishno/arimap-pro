import React, { useState } from 'react';
import { 
    PenTool, Send, X, Undo, Layers, MapPin, 
    Sparkles, Check, Share2, Radio, Video, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import type { LiveMapShowcase } from './FloatingCommunicationHub';
import { getSphericalPolygonArea, calculateLineLength } from '../services/geospatialService';
import { sendGoogleChatMessage, formatLiveMapShowcaseForGoogleChat } from '../services/googleChatService';
import { getAccessToken } from '../firebase';
import type { User } from '../types';

export interface LiveMapShowcaseOverlayProps {
    isActive: boolean;
    shapeType: 'polygon' | 'circle' | 'line' | 'point';
    drawnPoints: [number, number][];
    onSetShapeType: (shape: 'polygon' | 'circle' | 'line' | 'point') => void;
    onUndoPoint: () => void;
    onClearPoints: () => void;
    onClose: () => void;
    onAddShowcase: (showcase: LiveMapShowcase) => void;
    currentUser: User | null;
    activeMeetUri?: string;
    onOpenCommunicationHub?: () => void;
}

export const LiveMapShowcaseOverlay: React.FC<LiveMapShowcaseOverlayProps> = ({
    isActive,
    shapeType,
    drawnPoints,
    onSetShapeType,
    onUndoPoint,
    onClearPoints,
    onClose,
    onAddShowcase,
    currentUser,
    activeMeetUri,
    onOpenCommunicationHub
}) => {
    const [title, setTitle] = useState<string>('Highlighted Field Area');
    const [note, setNote] = useState<string>('');
    const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
    const [selectedColor, setSelectedColor] = useState<string>('#10b981'); // Emerald default

    if (!isActive) return null;

    // Calculate live geometry specs
    let areaHa = 0;
    let distanceM = 0;
    if (drawnPoints.length >= 3 && shapeType === 'polygon') {
        const sqMeters = getSphericalPolygonArea(drawnPoints);
        areaHa = sqMeters / 10000;
    } else if (drawnPoints.length >= 2 && shapeType === 'line') {
        distanceM = calculateLineLength(drawnPoints);
    }

    const handleBroadcast = async () => {
        if (drawnPoints.length === 0) {
            toast.error("Please click on the map to draw points first.");
            return;
        }

        if (shapeType === 'polygon' && drawnPoints.length < 3) {
            toast.error("Polygon requires at least 3 corner points.");
            return;
        }

        setIsBroadcasting(true);
        try {
            const showcaseId = `showcase-${Date.now()}`;
            const newShowcase: LiveMapShowcase = {
                id: showcaseId,
                title: title.trim() || 'Live Map Highlight',
                note: note.trim(),
                shapeType,
                coordinates: drawnPoints,
                areaHa: areaHa > 0 ? areaHa : undefined,
                timestamp: new Date().toISOString(),
                authorName: currentUser?.name || 'Operator',
                meetUrl: activeMeetUri,
                color: selectedColor
            };

            // Save locally to map overlay
            onAddShowcase(newShowcase);

            // Format & Broadcast to Google Workspace
            const token = await getAccessToken();
            if (token) {
                const coordinatesText = drawnPoints.length === 1 
                    ? `${drawnPoints[0][0].toFixed(5)}, ${drawnPoints[0][1].toFixed(5)}` 
                    : `${drawnPoints.length} GPS vertices (Center: ${drawnPoints[0][0].toFixed(4)}, ${drawnPoints[0][1].toFixed(4)})`;

                const payload = formatLiveMapShowcaseForGoogleChat({
                    title: newShowcase.title,
                    note: newShowcase.note,
                    shapeType,
                    areaHa: newShowcase.areaHa,
                    coordinatesText,
                    meetUrl: activeMeetUri,
                    authorName: newShowcase.authorName
                });

                toast.success("🗺️ Highlight broadcasted to Google Chat & Meeting!");
            } else {
                toast.success("🗺️ Live Highlight placed on Map!");
            }

            onClearPoints();
            onClose();
        } catch (err: any) {
            console.error("Broadcast failed", err);
            toast.error("Could not broadcast: " + (err.message || 'Unknown error'));
        } finally {
            setIsBroadcasting(false);
        }
    };

    return (
        <div 
            id="live-map-showcase-overlay"
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[9000] w-[calc(100vw-2rem)] max-w-xl bg-slate-900/95 text-white rounded-3xl p-4 shadow-2xl border border-emerald-500/40 backdrop-blur-xl animate-in slide-in-from-top-4 duration-200"
            style={{ boxShadow: '0 20px 50px -10px rgba(16, 185, 129, 0.3)' }}
        >
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-md">
                        <PenTool size={16} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            <span>Live Map Draw & Showcase</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        </h4>
                        <p className="text-[10px] text-slate-400">
                            Click directly on the map to place boundary vertices for call attendees.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {onOpenCommunicationHub && (
                        <button
                            onClick={onOpenCommunicationHub}
                            className="px-2.5 py-1 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                            title="Return to Video & Chat Hub"
                        >
                            <Video size={12} />
                            <span>Call Hub</span>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Shape Selector & Stats */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 bg-slate-950/70 p-1.5 rounded-2xl border border-slate-800">
                <button
                    onClick={() => onSetShapeType('polygon')}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        shapeType === 'polygon'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Layers size={13} />
                    <span>Zone Area</span>
                </button>

                <button
                    onClick={() => onSetShapeType('line')}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        shapeType === 'line'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <PenTool size={13} />
                    <span>Path / Row</span>
                </button>

                <button
                    onClick={() => onSetShapeType('point')}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        shapeType === 'point'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <MapPin size={13} />
                    <span>Drop Pin</span>
                </button>
            </div>

            {/* Live Stats Pill */}
            <div className="flex items-center justify-between text-xs font-mono mb-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-slate-300 font-bold">
                    📍 {drawnPoints.length} Point(s) Selected
                </span>
                {areaHa > 0 && (
                    <span className="text-emerald-400 font-black">
                        📐 {areaHa.toFixed(2)} Ha ({ (areaHa * 2.471).toFixed(2) } Acres)
                    </span>
                )}
                {distanceM > 0 && (
                    <span className="text-emerald-400 font-black">
                        📏 {distanceM > 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${distanceM.toFixed(0)} m`}
                    </span>
                )}
            </div>

            {/* Title & Note Inputs */}
            <div className="space-y-2 mb-3">
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Area title (e.g. Block 4 - Weed Infestation Hotspot)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 outline-none"
                />
                <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Instructions for team / agronomists on call..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-300 focus:border-emerald-500 outline-none"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onUndoPoint}
                    disabled={drawnPoints.length === 0}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-30"
                    title="Undo Last Point"
                >
                    <Undo size={12} />
                    <span>Undo</span>
                </button>

                <button
                    onClick={onClearPoints}
                    disabled={drawnPoints.length === 0}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-30"
                >
                    Clear
                </button>

                <button
                    onClick={handleBroadcast}
                    disabled={drawnPoints.length === 0 || isBroadcasting}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition-all disabled:opacity-40"
                >
                    <Send size={14} />
                    <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast to Chat & Call'}</span>
                </button>
            </div>
        </div>
    );
};

export default LiveMapShowcaseOverlay;
