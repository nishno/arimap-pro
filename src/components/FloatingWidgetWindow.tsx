import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    GripHorizontal, Minus, Maximize2, Minimize2, X, 
    ExternalLink, Sparkles, Move, MoveHorizontal, MoveVertical
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface FloatingWidgetWindowProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon?: React.ReactNode;
    badge?: string;
    children: React.ReactNode;
    initialWidth?: number;
    initialHeight?: number;
}

export const FloatingWidgetWindow: React.FC<FloatingWidgetWindowProps> = ({
    isOpen,
    onClose,
    title,
    icon,
    badge,
    children,
    initialWidth = 760,
    initialHeight = 600
}) => {
    const { t } = useLanguage();
    const displayBadge = badge || t('dash.window.operational');
    // Window position
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    // Window dimensions
    const [size, setSize] = useState<{ width: number; height: number }>({
        width: initialWidth,
        height: initialHeight
    });
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Dragging state
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Resizing state
    const isResizingRef = useRef<false | 'se' | 'e' | 'w' | 's' | 'n'>(false);
    const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number; posX: number; posY: number }>({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });

    // Window container ref
    const containerRef = useRef<HTMLDivElement>(null);

    // Center window on initial open if not placed
    useEffect(() => {
        if (isOpen && !pos && typeof window !== 'undefined') {
            const defaultW = Math.min(initialWidth, window.innerWidth - 40);
            const defaultH = Math.min(initialHeight, window.innerHeight - 60);
            const centerX = Math.max(20, Math.floor((window.innerWidth - defaultW) / 2));
            const centerY = Math.max(20, Math.floor((window.innerHeight - defaultH) / 2));
            setPos({ x: centerX, y: centerY });
            setSize({ width: defaultW, height: defaultH });
        }
    }, [isOpen, initialWidth, initialHeight, pos]);

    // Handle Dragging
    const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isMaximized) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        const currentX = pos?.x ?? 40;
        const currentY = pos?.y ?? 40;
        dragOffsetRef.current = {
            x: e.clientX - currentX,
            y: e.clientY - currentY
        };
    };

    const handleDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current || isMaximized) return;
        const nextX = Math.max(10, Math.min(window.innerWidth - 120, e.clientX - dragOffsetRef.current.x));
        const nextY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffsetRef.current.y));
        setPos({ x: nextX, y: nextY });
    };

    const handleDragPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore pointer capture release failure
            }
        }
    };

    // Handle Live Resizing in 4 directions
    const handleResizePointerDown = (direction: 'se' | 'e' | 'w' | 's' | 'n', e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (isMaximized) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        isResizingRef.current = direction;
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            w: size.width,
            h: size.height,
            posX: pos?.x ?? 40,
            posY: pos?.y ?? 40
        };
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isResizingRef.current || isMaximized) return;
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        const dir = isResizingRef.current;

        if (dir === 'e' || dir === 'se') {
            const nextW = Math.max(380, Math.min(window.innerWidth - 40, resizeStartRef.current.w + deltaX));
            setSize(prev => ({ ...prev, width: nextW }));
        } else if (dir === 'w') {
            const nextW = Math.max(380, Math.min(window.innerWidth - 40, resizeStartRef.current.w - deltaX));
            const nextPosX = Math.max(10, resizeStartRef.current.posX + deltaX);
            setSize(prev => ({ ...prev, width: nextW }));
            setPos(prev => prev ? { ...prev, x: nextPosX } : { x: nextPosX, y: 40 });
        }

        if (dir === 's' || dir === 'se') {
            const nextH = Math.max(280, Math.min(window.innerHeight - 40, resizeStartRef.current.h + deltaY));
            setSize(prev => ({ ...prev, height: nextH }));
        } else if (dir === 'n') {
            const nextH = Math.max(280, Math.min(window.innerHeight - 40, resizeStartRef.current.h - deltaY));
            const nextPosY = Math.max(10, resizeStartRef.current.posY + deltaY);
            setSize(prev => ({ ...prev, height: nextH }));
            setPos(prev => prev ? { ...prev, y: nextPosY } : { x: 40, y: nextPosY });
        }
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isResizingRef.current) {
            isResizingRef.current = false;
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                // Ignore
            }
        }
    };

    if (!isOpen) return null;

    // Render Minimized Docked Bar
    if (isMinimized) {
        return (
            <div 
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: pos ? `${pos.x}px` : '32px',
                    zIndex: 9200
                }}
                className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 shadow-2xl rounded-2xl px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition-all select-none animate-in slide-in-from-bottom-4"
                onClick={() => setIsMinimized(false)}
            >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="flex items-center gap-2">
                    {icon && <span className="text-emerald-400">{icon}</span>}
                    <span className="text-xs font-black uppercase tracking-wider">{title}</span>
                </div>
                <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    {displayBadge}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsMinimized(false);
                    }}
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                    title={t('dash.window.restore_window')}
                >
                    <Maximize2 size={13} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="p-1 hover:bg-rose-900/60 rounded text-slate-400 hover:text-rose-300 cursor-pointer"
                    title={t('dash.window.close')}
                >
                    <X size={13} />
                </button>
            </div>
        );
    }

    const windowStyle: React.CSSProperties = isMaximized
        ? {
            position: 'fixed',
            inset: '16px',
            zIndex: 9200,
            width: 'calc(100vw - 32px)',
            height: 'calc(100vh - 32px)'
        }
        : {
            position: 'fixed',
            left: pos ? `${pos.x}px` : '40px',
            top: pos ? `${pos.y}px` : '40px',
            width: `${size.width}px`,
            height: `${size.height}px`,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100vh - 24px)',
            zIndex: 9200
        };

    return (
        <div 
            ref={containerRef}
            style={windowStyle}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 relative pointer-events-auto"
        >
            {/* Window Top Bar / Header with "Move Ability" matching screenshot */}
            <div 
                className="p-3 bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-b border-slate-200/80 flex items-center justify-between select-none shrink-0 gap-3"
            >
                {/* Left drag handle and title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div 
                        onPointerDown={handleDragPointerDown}
                        onPointerMove={handleDragPointerMove}
                        onPointerUp={handleDragPointerUp}
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-all cursor-move shrink-0 flex items-center gap-1 group"
                        title={t('dash.window.drag_move')}
                    >
                        <GripHorizontal size={16} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">{t('dash.window.move')}</span>
                    </div>

                    {icon && (
                        <div className="p-1.5 bg-emerald-50 rounded-xl border border-emerald-200/60 text-emerald-600 shrink-0">
                            {icon}
                        </div>
                    )}

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-tight truncate">
                                {title}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {displayBadge}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right controls: POP-UP, DIAGNOSTICS, Minimize, Maximize, Close matching user screenshot */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="hidden sm:flex items-center gap-1 mr-1">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-lg shadow-2xs flex items-center gap-1">
                            <ExternalLink size={10} />
                            {t('dash.window.popup')}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg shadow-2xs flex items-center gap-1">
                            <Sparkles size={10} />
                            {t('dash.window.live_widget')}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                        {/* Minimize (-) */}
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            className="w-7 h-7 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/80 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={t('dash.window.minimize')}
                        >
                            <Minus size={13} strokeWidth={2.5} />
                        </button>

                        {/* Maximize / Restore [↗ / ⤡] */}
                        <button
                            type="button"
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={isMaximized ? t('dash.window.restore') : t('dash.window.maximize')}
                        >
                            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                        </button>

                        {/* Close (✕) */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-7 h-7 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 hover:border-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            title={t('dash.window.close')}
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Window Content Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-slate-50/50 custom-scrollbar">
                {children}
            </div>

            {/* Live Resize Handles on 4 sides with hover arrow indicators matching screenshot */}
            {!isMaximized && (
                <>
                    {/* Bottom-Right Corner handle */}
                    <div 
                        onPointerDown={(e) => handleResizePointerDown('se', e)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        className="group/corner absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 flex items-end justify-end p-1 select-none"
                        title={t('dash.window.drag_corner')}
                    >
                        <div className="w-3 h-3 border-r-2 border-b-2 border-slate-400 group-hover/corner:border-indigo-600 transition-colors" />
                    </div>

                    {/* Right edge handle (↔) */}
                    <div 
                        onPointerDown={(e) => handleResizePointerDown('e', e)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        className="group/edge-r absolute top-14 bottom-6 -right-2 w-4 cursor-ew-resize z-40 flex items-center justify-center select-none"
                        title={t('dash.card.resize_width')}
                    >
                        <div className="w-5 h-8 bg-indigo-600 text-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/edge-r:opacity-100 hover:scale-110 transition-all -mr-1">
                            <MoveHorizontal size={12} className="stroke-[2.5]" />
                        </div>
                    </div>

                    {/* Left edge handle (↔) */}
                    <div 
                        onPointerDown={(e) => handleResizePointerDown('w', e)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        className="group/edge-l absolute top-14 bottom-6 -left-2 w-4 cursor-ew-resize z-40 flex items-center justify-center select-none"
                        title={t('dash.card.resize_width')}
                    >
                        <div className="w-5 h-8 bg-indigo-600 text-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/edge-l:opacity-100 hover:scale-110 transition-all -ml-1">
                            <MoveHorizontal size={12} className="stroke-[2.5]" />
                        </div>
                    </div>

                    {/* Bottom edge handle (↕) */}
                    <div 
                        onPointerDown={(e) => handleResizePointerDown('s', e)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        className="group/edge-b absolute -bottom-2 left-8 right-8 h-4 cursor-ns-resize z-40 flex items-center justify-center select-none"
                        title={t('dash.card.resize_height')}
                    >
                        <div className="h-5 w-8 bg-indigo-600 text-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/edge-b:opacity-100 hover:scale-110 transition-all -mb-1">
                            <MoveVertical size={12} className="stroke-[2.5]" />
                        </div>
                    </div>

                    {/* Top edge handle (↕) */}
                    <div 
                        onPointerDown={(e) => handleResizePointerDown('n', e)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        className="group/edge-t absolute -top-2 left-8 right-8 h-4 cursor-ns-resize z-40 flex items-center justify-center select-none"
                        title={t('dash.card.resize_height')}
                    >
                        <div className="h-5 w-8 bg-indigo-600 text-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/edge-t:opacity-100 hover:scale-110 transition-all -mt-1">
                            <MoveVertical size={12} className="stroke-[2.5]" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
